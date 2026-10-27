import { DurableObject } from "cloudflare:workers";
import { JoinGameRes, LobbyInfo, PostObject, Ranking, SendData } from "../types";
import { Env, version } from "./env";
import * as db from "./db";
import { Profile, SubscriptionInformation } from "./db";
import { Game, SavedGame } from "./game";
import { getCookies, makeCookie } from "./auth";
import { sendPushNotification } from "./push";

/** How long a cached profile is trusted before it is reloaded from the database. */
const PROFILE_TTL = 10_000;

/** Storage key the public game is saved under. */
const SAVE_KEY = "game";
/** Prefix of the storage keys private lobbies are saved under, followed by the lobby code. */
const LOBBY_PREFIX = "lobby:";

/** Code of the public game. Private lobbies have a {@link LOBBY_CODE_LENGTH} character code. */
const PUBLIC = "";
const LOBBY_CODE_LENGTH = 5;
/** Letters used in lobby codes, leaving out ones that are easy to mix up (0/O, 1/I). */
const LOBBY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_LOBBIES = 50;
/** How long an empty private lobby is kept, so its creator has time to load it. */
const EMPTY_LOBBY_GRACE = 60_000;

/** Data kept on each websocket, survives hibernation. */
type SocketAttachment = { id: string; username: string; lobby: string };

type Lobby = {
    game: Game;
    /** Username of the user that made the lobby. */
    host: string;
    createdAt: number;
};

type SavedLobby = { game: SavedGame; host: string; createdAt: number };

/** Lobby code from a request's `?lobby=` parameter, {@link PUBLIC} when there is none. */
function lobbyCodeOf(request: Request): string {
    return (new URL(request.url).searchParams.get("lobby") ?? PUBLIC).toUpperCase();
}

function randomLobbyCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(LOBBY_CODE_LENGTH));
    return [...bytes].map((b) => LOBBY_CODE_CHARS[b % LOBBY_CODE_CHARS.length]).join("");
}

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

/**
 * Every game: the public one and any private lobbies. Every request about a game or a user's social
 * data goes through this one object, so in-memory state stays consistent the same way it did on the
 * Node server, and notifications know who is online in any lobby.
 *
 * Clients hold a websocket open and are sent their full {@link SendData} whenever anything changes.
 * Actions still come in as POST requests. The websockets use the hibernation API, so the object
 * can be evicted while nobody is playing; the game state is saved to storage for that reason.
 */
export class GameRoom extends DurableObject<Env> {
    /** Games by lobby code, the public game is {@link PUBLIC}. */
    private lobbies = new Map<string, Lobby>();
    /** Lobbies that changed since they were last saved. */
    private unsaved = new Set<string>();
    private rankings: Ranking[] = [];
    /** Profiles by google id. */
    private profiles = new Map<string, { profile: Profile; loadedAt: number }>();
    /** Key value pair of usernames to when they were last sent a notification. */
    private lastNotified: Record<string, number> = {};
    private broadcastScheduled = false;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);

        const publicGame = this.addLobby(PUBLIC, "", Date.now());
        const saved = ctx.storage.kv.get<SavedGame>(SAVE_KEY);
        if (saved) publicGame.restore(saved);

        for (const [key, lobby] of ctx.storage.kv.list<SavedLobby>({ prefix: LOBBY_PREFIX })) {
            this.addLobby(key.slice(LOBBY_PREFIX.length), lobby.host, lobby.createdAt).restore(lobby.game);
        }

        // Answers keep-alive pings without waking the object up
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));

        // Set rankings on startup
        ctx.blockConcurrencyWhile(() => this.refreshRankings());
    }

    private addLobby(code: string, host: string, createdAt: number): Game {
        const { env } = this;
        const game = new Game({
            addToScore: async (username, delta) => {
                await db.addToScore(env.DB, username, delta);
                this.invalidate(username);
            },
            recordGame: async (username, points, won, score, busts) => {
                await db.recordGame(env.DB, username, points, won, score, busts);
                this.invalidate(username);
            },
            logChatMessage: (username, realName, message) => db.logChatMessage(env.DB, username, realName, message),
            refreshRankings: () => this.refreshRankings(),
            onChange: () => {
                this.unsaved.add(code);
                this.scheduleBroadcast();
            }
        }, code == PUBLIC);
        this.lobbies.set(code, { game, host, createdAt });
        return game;
    }

    /** Reloads the rankings, which every lobby shows. */
    private async refreshRankings(): Promise<void> {
        this.rankings = await db.getRankings(this.env.DB);
        this.scheduleBroadcast();
    }

    private saveLobbies(): void {
        for (const code of this.unsaved) {
            const lobby = this.lobbies.get(code);
            if (!lobby) continue;
            if (code == PUBLIC) {
                this.ctx.storage.kv.put(SAVE_KEY, lobby.game.save());
            } else {
                this.ctx.storage.kv.put(LOBBY_PREFIX + code, { game: lobby.game.save(), host: lobby.host, createdAt: lobby.createdAt } satisfies SavedLobby);
            }
        }
        this.unsaved.clear();
    }

    /** Throws away private lobbies that nobody is in or looking at. */
    private removeEmptyLobbies(): void {
        for (const [code, lobby] of this.lobbies) {
            if (code == PUBLIC || !lobby.game.empty || Date.now() - lobby.createdAt < EMPTY_LOBBY_GRACE) continue;
            if (this.socketsIn(code).length > 0) continue;
            lobby.game.stop();
            this.lobbies.delete(code);
            this.unsaved.delete(code);
            this.ctx.storage.kv.delete(LOBBY_PREFIX + code);
        }
    }

    private socketsIn(code: string): WebSocket[] {
        return this.ctx.getWebSockets().filter((ws) =>
            ws.readyState == WebSocket.OPEN && (ws.deserializeAttachment() as SocketAttachment).lobby == code);
    }

    /** The lobby's maker, or if they've left, whoever has been in it the longest. */
    private hostOf(code: string): string {
        const lobby = this.lobbies.get(code)!;
        const here = this.socketsIn(code).map((ws) => (ws.deserializeAttachment() as SocketAttachment).username);
        return here.length == 0 || here.includes(lobby.host) ? lobby.host : here[0];
    }

    async fetch(request: Request): Promise<Response> {
        const id = request.headers.get("X-User-Id");
        const profile = id ? await this.getProfile(id) : null;

        if (!profile) {
            return new Response("Unauthorized", { status: 401 });
        }

        const key: string | undefined = getCookies(request).key;
        const { pathname } = new URL(request.url);
        const code = lobbyCodeOf(request);
        const lobby = this.lobbies.get(code);

        switch (pathname) {
            case "/ws": {
                if (request.headers.get("Upgrade") != "websocket") {
                    return new Response("Expected websocket", { status: 426 });
                }
                const { 0: client, 1: server } = new WebSocketPair();
                if (!lobby) {
                    // A browser can't read the status of a failed upgrade, so the close code says why
                    server.accept();
                    server.close(4004, "Lobby not found");
                    return new Response(null, { status: 101, webSocket: client });
                }
                this.ctx.acceptWebSocket(server);
                server.serializeAttachment({ id: id!, username: profile.user.username, lobby: code } satisfies SocketAttachment);
                server.send(JSON.stringify(this.getData(profile, code)));
                // A new host may have taken over, everybody else in the lobby needs to know
                if (code != PUBLIC) this.scheduleBroadcast();
                return new Response(null, { status: 101, webSocket: client });
            }
            case "/post": {
                const res = await this.handlePost(profile, key, await request.json(), code);
                this.scheduleBroadcast();
                return res;
            }
            case "/leave":
                if (key) lobby?.game.removePlayer(profile.user.username, key);
                this.removeEmptyLobbies();
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
        const { username, lobby } = ws.deserializeAttachment() as SocketAttachment;
        try { ws.close(code, "closed"); } catch { }

        // Closing the page while waiting for the game to start leaves the game
        if (!this.socketsIn(lobby).some((other) => other != ws && (other.deserializeAttachment() as SocketAttachment).username == username)) {
            this.lobbies.get(lobby)?.game.removeLobbyPlayer(username);
        }
        this.removeEmptyLobbies();
        this.scheduleBroadcast();
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
        this.saveLobbies();

        for (const ws of this.ctx.getWebSockets()) {
            const { id, lobby } = ws.deserializeAttachment() as SocketAttachment;
            const profile = await this.getProfile(id);
            try {
                if (!profile) ws.close(4001, "Unauthorized");
                else if (!this.lobbies.has(lobby)) ws.close(4004, "Lobby not found");
                else ws.send(JSON.stringify(this.getData(profile, lobby)));
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

    private async getProfileByUsername(username: string, ignoreCase: boolean = false): Promise<Profile | null> {
        const user = await db.getUserByUsername(this.env.DB, username, ignoreCase);
        return user ? this.getProfile(user.id) : null;
    }

    /**
     * Sends notification to a user.
     * @param applyTimeout Whether or no to use/apply the notification timeout. Defaults to `true`.
     * @param url Page opened when the notification is clicked.
     */
    private async notify(profile: Profile, title: string, body: string, applyTimeout: boolean = true, url?: string): Promise<void> {
        const { username } = profile.user;
        // Users with the game open don't need a notification
        if (profile.user.silent || this.isConnected(username)) return;
        if (applyTimeout) {
            if (this.lastNotified[username] && Date.now() - this.lastNotified[username] < 5000) return;
            this.lastNotified[username] = Date.now();
        }
        const subscriptions = await db.getSubscriptions(this.env.DB, username);
        this.ctx.waitUntil(sendPushNotification(this.env, subscriptions, title, body, url));
    }

    /** Notifies users that were @mentioned in a chat message, unless they've blocked the sender. */
    private async notifyMentions(sender: Profile, message: string): Promise<void> {
        const mentioned = new Set([...message.matchAll(/@([^\s@:,.!?]+)/g)].map((m) => m[1].toLowerCase()));

        // Limits how many people one message can ping
        for (const name of [...mentioned].slice(0, 5)) {
            const target = await this.getProfileByUsername(name, true);
            if (!target || target.user.username == sender.user.username || target.blocked.includes(sender.user.username)) continue;
            await this.notify(target, `${sender.user.username} mentioned you`, message.slice(0, 50));
        }
    }

    // Routes

    private getData(profile: Profile, code: string): SendData {
        const { game } = this.lobbies.get(code)!;
        const lobby: LobbyInfo | null = code == PUBLIC ? null : { code, host: this.hostOf(code) };

        const { user } = profile;
        return {
            ...game.visibleData(),
            rankings: this.rankings,
            lobby: lobby,
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
                silent: user.silent,
                stats: {
                    score: user.score,
                    wins: user.wins,
                    gamesPlayed: user.gamesPlayed,
                    bestGame: user.bestGame,
                    busts: user.busts
                }
            }
        };
    }

    private async handlePost(profile: Profile, key: string | undefined, body: PostObject, code: string): Promise<Response> {
        const lobby = this.lobbies.get(code);
        const { user } = profile;
        const DB = this.env.DB;

        if (body.action == "createLobby") {
            if (this.lobbies.size > MAX_LOBBIES) {
                return json({ res: "Too many lobbies right now, try again later." })
            }
            let newCode = randomLobbyCode();
            while (this.lobbies.has(newCode)) newCode = randomLobbyCode();
            this.addLobby(newCode, user.username, Date.now());
            this.unsaved.add(newCode);
            return json({ res: { code: newCode } })
        }

        // Everything else about the game needs the lobby to exist, social actions below don't
        const game = lobby?.game;
        const gameAction = ["join", "chat", "chatInGame", "start", "play", "lobbySettings"].includes(body.action);
        if (gameAction && !game) {
            return json({ res: "lobbyNotFound" })
        }

        // Only the host can change a private lobby's settings, before the game starts
        if (body.action == "lobbySettings" && game && code != PUBLIC && this.hostOf(code) == user.username) {
            const changed = game.setPointsToWin(body.pointsToWin);
            if (changed) this.unsaved.add(code);
            return json({ res: changed ? "OK" : "incorrectDataSent" })
        }

        // Joining game
        if (body.action == "join" && body.name && game) {
            const joinGameRes: JoinGameRes = game.joinGame(body.name, user, game.game.canJoin)

            if (joinGameRes.status == "error") {
                return json({ res: joinGameRes })
            }
            return json({ res: "OK" }, { headers: { "Set-Cookie": makeCookie("key", joinGameRes.key) } })
        }

        // Chatting for players not in the game
        if (body.action == "chat" && body.message && game) {
            game.sendMessage(body.message, user)
            this.notifyMentions(profile, body.message).catch(console.error)
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
                    this.notify(friend, "Friend request accepted", `${user.username} is now your friend.`).catch(console.error)
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
            // Users that blocked us (e.g. by denying an earlier request) can't be sent requests
            if (friend && friend.user.username != user.username && !profile.friends.includes(friend.user.username) && !friend.blocked.includes(user.username)) {
                if (profile.friendRequests.includes(friend.user.username)) {
                    await db.addFriend(DB, user.username, friend.user.username)
                    this.notify(friend, "Friend request accepted", `${user.username} is now your friend.`).catch(console.error)
                } else if (!profile.requestedFriends.includes(friend.user.username) && friend.user.acceptingFriendRequests) {
                    await db.addFriendRequest(DB, user.username, friend.user.username)
                    this.notify(friend, "New friend request", `${user.username} wants to be your friend.`).catch(console.error)
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
            if (code == PUBLIC) {
                this.notify(friend, "Invited to Probability Simulator!", `${user.username} has invited you to play!`).catch(console.error)
            } else {
                this.notify(friend, "Invited to a private lobby!", `${user.username} has invited you to lobby ${code}.`, true, `/game?lobby=${code}`).catch(console.error)
            }
            return json({ res: "OK" })
        }

        // From here on out only players with their correct game key can do actions

        // Chatting for players in the game
        if (!game || !key) {
            return json({ res: "incorrectDataSent" })
        }

        if (body.action == "chatInGame" && body.message && body.name && game.playerKeys[body.name] == key) {
            game.sendMessage(body.message, user, body.name);
            this.notifyMentions(profile, body.message).catch(console.error)
            return json({ res: "OK" });
        }

        // Starting the game
        if (body.action == "start" && body.name && game.playerKeys[body.name] == key) {
            game.voteStartGame(user.username);
            return json({ res: "OK" });
        }

        // Making a move
        if (body.action == "play" && body.move && body.name && game.playerKeys[body.name] == key) {
            game.makeMove(body.move, body.name)
            return json({ res: "OK" });
        }

        return json({ res: "incorrectDataSent" })
    }
}
