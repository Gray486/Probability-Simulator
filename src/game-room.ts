import { DurableObject } from "cloudflare:workers";
import { GameData, JoinGameRes, PostObject, SendData } from "../types";
import { Env, version } from "./env";
import * as db from "./db";
import { Profile, SubscriptionInformation } from "./db";
import { Game, SavedGame } from "./game";
import { getCookies, makeCookie } from "./auth";
import { sendPushNotification } from "./push";

/** How long a cached profile is trusted before it is reloaded from the database. */
const PROFILE_TTL = 10_000;

/** Storage key the game state is saved under. */
const SAVE_KEY = "game";

/** Data kept on each websocket, survives hibernation. */
type SocketAttachment = { id: string; username: string };

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

/**
 * The single, global game. Every request about the game or a user's social data goes through
 * this one object, so in-memory state stays consistent the same way it did on the Node server.
 *
 * Clients hold a websocket open and are sent their full {@link SendData} whenever anything changes.
 * Actions still come in as POST requests. The websockets use the hibernation API, so the object
 * can be evicted while nobody is playing; the game state is saved to storage for that reason.
 */
export class GameRoom extends DurableObject<Env> {
    private game: Game;
    /** Data that is allowed to be viewed by clients at this time. */
    private allowedData: GameData | null = null;
    /** Profiles by google id. */
    private profiles = new Map<string, { profile: Profile; loadedAt: number }>();
    /** Key value pair of usernames to when they were last sent a notification. */
    private lastNotified: Record<string, number> = {};
    private broadcastScheduled = false;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.game = new Game({
            addToScore: (username, delta, winDelta) => db.addToScore(env.DB, username, delta, winDelta),
            logChatMessage: (username, realName, message) => db.logChatMessage(env.DB, username, realName, message),
            getRankings: () => db.getRankings(env.DB),
            onChange: () => this.scheduleBroadcast()
        });

        const saved = ctx.storage.kv.get<SavedGame>(SAVE_KEY);
        if (saved) this.game.restore(saved);

        // Answers keep-alive pings without waking the object up
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));

        // Set rankings on startup
        ctx.blockConcurrencyWhile(() => this.game.setRankings());
    }

    async fetch(request: Request): Promise<Response> {
        const id = request.headers.get("X-User-Id");
        const profile = id ? await this.getProfile(id) : null;

        if (!profile) {
            return new Response("Unauthorized", { status: 401 });
        }

        const key: string | undefined = getCookies(request).key;
        const { pathname } = new URL(request.url);

        switch (pathname) {
            case "/ws": {
                if (request.headers.get("Upgrade") != "websocket") {
                    return new Response("Expected websocket", { status: 426 });
                }
                const { 0: client, 1: server } = new WebSocketPair();
                this.ctx.acceptWebSocket(server);
                server.serializeAttachment({ id: id!, username: profile.user.username } satisfies SocketAttachment);
                server.send(JSON.stringify(this.getData(profile)));
                return new Response(null, { status: 101, webSocket: client });
            }
            case "/post": {
                const res = await this.handlePost(profile, key, await request.json());
                this.scheduleBroadcast();
                return res;
            }
            case "/leave":
                if (key) await this.game.removePlayer(profile.user.username, key);
                this.scheduleBroadcast();
                return new Response("OK");
            case "/subscribe": {
                const subscription: SubscriptionInformation = await request.json();
                if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
                    return new Response("Bad subscription", { status: 400 });
                }
                await db.addSubscription(this.env.DB, profile.user.username, subscription);
                return new Response("Subscribed", { status: 201 });
            }
        }

        return new Response("Not found", { status: 404 });
    }

    // Websockets

    async webSocketMessage(): Promise<void> {
        // Clients only listen, actions are sent with POST requests
    }

    async webSocketClose(ws: WebSocket, code: number): Promise<void> {
        const { username } = ws.deserializeAttachment() as SocketAttachment;
        try { ws.close(code, "closed"); } catch { }

        // Closing the page while waiting in the lobby leaves the game
        if (!this.isConnected(username, ws)) {
            this.game.removeLobbyPlayer(username);
            this.scheduleBroadcast();
        }
    }

    async webSocketError(ws: WebSocket): Promise<void> {
        await this.webSocketClose(ws, 1011);
    }

    /** Whether the user has a websocket open, ignoring `except`. */
    private isConnected(username: string, except?: WebSocket): boolean {
        return this.ctx.getWebSockets().some((ws) =>
            ws != except && ws.readyState == WebSocket.OPEN && (ws.deserializeAttachment() as SocketAttachment).username == username);
    }

    /** Sends every client the current state, batching changes that happen together. */
    private scheduleBroadcast(): void {
        if (this.broadcastScheduled) return;
        this.broadcastScheduled = true;
        queueMicrotask(() => {
            this.broadcastScheduled = false;
            this.broadcast().catch(console.error);
        });
    }

    private async broadcast(): Promise<void> {
        this.ctx.storage.kv.put(SAVE_KEY, this.game.save());

        for (const ws of this.ctx.getWebSockets()) {
            const { id } = ws.deserializeAttachment() as SocketAttachment;
            const profile = await this.getProfile(id);
            try {
                if (profile) ws.send(JSON.stringify(this.getData(profile)));
                else ws.close(4001, "Unauthorized");
            } catch { }
        }
    }

    // Profiles

    private async getProfile(id: string): Promise<Profile | null> {
        const cached = this.profiles.get(id);
        if (cached && Date.now() - cached.loadedAt < PROFILE_TTL) return cached.profile;

        const user = await db.getUserById(this.env.DB, id);
        if (!user) return null;

        const profile = await db.loadProfile(this.env.DB, user);
        this.profiles.set(id, { profile, loadedAt: Date.now() });
        return profile;
    }

    /** Forces the profiles of the given users to be reloaded on their next request. */
    private invalidate(...usernames: string[]): void {
        for (const [id, { profile }] of this.profiles) {
            if (usernames.includes(profile.user.username)) this.profiles.delete(id);
        }
    }

    private async getProfileByUsername(username: string): Promise<Profile | null> {
        const user = await db.getUserByUsername(this.env.DB, username);
        return user ? this.getProfile(user.id) : null;
    }

    /**
     * Sends notification to a user.
     * @param applyTimeout Whether or no to use/apply the notification timeout. Defaults to `true`.
     */
    private async notify(profile: Profile, title: string, body: string, applyTimeout: boolean = true): Promise<void> {
        const { username } = profile.user;
        // Users with the game open don't need a notification
        if (profile.user.silent || this.isConnected(username)) return;
        if (applyTimeout) {
            if (this.lastNotified[username] && Date.now() - this.lastNotified[username] < 5000) return;
            this.lastNotified[username] = Date.now();
        }
        const subscriptions = await db.getSubscriptions(this.env.DB, username);
        this.ctx.waitUntil(sendPushNotification(this.env, subscriptions, title, body));
    }

    // Routes

    private getData(profile: Profile): SendData {
        const { game } = this;

        if (game.sendData || !this.allowedData) {
            // Copies the object so later changes aren't visible until sending is allowed again
            this.allowedData = structuredClone(game.data);
        }

        const { user } = profile;
        return {
            ...this.allowedData,
            live: game.sendData,
            chat: game.chat,
            version: version,
            me: {
                name: user.realName,
                username: user.username,
                friends: profile.friends,
                friendRequests: profile.friendRequests,
                blockedUsers: profile.blocked,
                directMessageChannels: profile.directMessageChannels.map(({ messageIds, ...channel }) => channel),
                acceptingFriendRequests: user.acceptingFriendRequests,
                silent: user.silent
            }
        };
    }

    private async handlePost(profile: Profile, key: string | undefined, body: PostObject): Promise<Response> {
        const { game } = this;
        const { user } = profile;
        const DB = this.env.DB;

        // Joining game
        if (body.action == "join" && body.name) {
            const joinGameRes: JoinGameRes = game.joinGame(body.name, user, game.game.canJoin)

            if (joinGameRes.status == "error") {
                return json({ res: joinGameRes })
            }
            return json({ res: "OK" }, { headers: { "Set-Cookie": makeCookie("key", joinGameRes.key) } })
        }

        // Chatting for players not in the game
        if (body.action == "chat" && body.message) {
            game.sendMessage(body.message, user)
            return json({ res: "OK" });
        }

        // Accepting requests, or denying requests / removing friends (which blocks them)
        if (body.action == "handleFriend" && body.username && (body.accept == false || body.accept == true)) {
            const friend = await this.getProfileByUsername(body.username);
            if (!friend) {
                return json({ res: "incorrectDataSent" })
            }
            if (body.accept) {
                if (!profile.friends.includes(friend.user.username) && profile.friendRequests.includes(friend.user.username)) {
                    await db.addFriend(DB, user.username, friend.user.username)
                }
            } else {
                await db.unfriendAndBlock(DB, user.username, friend.user.username)
            }
            this.invalidate(user.username, friend.user.username)
            return json({ res: "OK" })
        }

        if (body.action == "silentToggle" && (body.mode == false || body.mode == true)) {
            await db.updateUser(DB, user.username, { silent: body.mode })
            this.invalidate(user.username)
            return json({ res: "OK" });
        }

        if (body.action == "acceptRequestsToggle" && (body.mode == false || body.mode == true)) {
            await db.updateUser(DB, user.username, { acceptingFriendRequests: body.mode })
            this.invalidate(user.username)
            return json({ res: "OK" });
        }

        if (body.action == "unblock" && body.username) {
            await db.unblock(DB, user.username, body.username)
            this.invalidate(user.username)
            return json({ res: "OK" });
        }

        // Requests to friend a user, if user already requested us, then adds friend
        if (body.action == "addFriend" && body.username) {
            const friend = await this.getProfileByUsername(body.username);
            if (friend && friend.user.username != user.username && !profile.friends.includes(friend.user.username)) {
                if (profile.friendRequests.includes(friend.user.username)) {
                    await db.addFriend(DB, user.username, friend.user.username)
                } else if (!profile.requestedFriends.includes(friend.user.username) && friend.user.acceptingFriendRequests) {
                    await db.addFriendRequest(DB, user.username, friend.user.username)
                }
                this.invalidate(user.username, friend.user.username)
            }
            return json({ res: "OK" });
        }

        if (body.action == "messageFriend" && body.username && body.message) {
            const friend = await this.getProfileByUsername(body.username);
            if (!friend || !profile.friends.includes(friend.user.username)) {
                return json({ res: "friendNotFound" })
            }

            const content = body.message.slice(0, 50);
            this.notify(friend, `${user.username} sent you a message.`, content).catch(console.error)
            await db.addDirectMessage(DB, user.username, friend.user.username, content)
            this.invalidate(user.username, friend.user.username)
            return json({ res: "OK" })
        }

        if (body.action == "readMessages" && body.friend && Array.isArray(body.messageReverseIndices)) {
            const channel = profile.directMessageChannels.find((c) => c.initiatedBy == body.friend || c.receiver == body.friend);
            if (channel) {
                const ids: number[] = [];
                for (const reverseIndex of body.messageReverseIndices) {
                    const id = channel.messageIds[channel.messageIds.length - reverseIndex];
                    if (id != undefined) ids.push(id);
                }
                await db.markMessagesRead(DB, ids)
                this.invalidate(user.username, body.friend)
            }
            return json({ res: "OK" });
        }

        if (body.action == "inviteFriend" && body.username) {
            const friend = await this.getProfileByUsername(body.username);
            if (!friend || !profile.friends.includes(friend.user.username)) {
                return json({ res: "friendNotFound" })
            }
            this.notify(friend, "Invited to Probability Simulator!", `${user.username} has invited you to play!`).catch(console.error)
            return json({ res: "OK" })
        }

        // From here on out only players with their correct game key can do actions

        // Chatting for players in the game
        if (body.action == "chatInGame" && body.message && body.name && key && game.playerKeys[body.name] == key) {
            game.sendMessage(body.message, user, body.name);
            return json({ res: "OK" });
        }

        // Starting the game
        if (body.action == "start" && body.name && key && game.playerKeys[body.name] == key) {
            game.voteStartGame(user.username);
            return json({ res: "OK" });
        }

        // Making a move
        if (body.action == "play" && body.move && body.name && key && game.playerKeys[body.name] == key) {
            game.makeMove(body.move, body.name)
            return json({ res: "OK" });
        }

        return json({ res: "incorrectDataSent" })
    }
}
