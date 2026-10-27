import { DirectMessageChannel, Message } from "../types";

export interface UserRow {
    username: string;
    id: string;
    realName: string;
    score: number;
    wins: number;
    lastInvite: number | null;
    silent: boolean;
    acceptingFriendRequests: boolean;
}

export interface SubscriptionInformation {
    endpoint: string;
    expirationTime?: null | number;
    keys: {
        p256dh: string;
        auth: string;
    }
}

/** A DM channel with the database id of every message, used to mark messages read. */
export type StoredDirectMessageChannel = DirectMessageChannel & { messageIds: number[] };

/** A user plus all of their relations. */
export interface Profile {
    user: UserRow;
    friends: string[];
    /** Users that have sent this user a friend request. */
    friendRequests: string[];
    /** Users this user has sent a friend request to. */
    requestedFriends: string[];
    blocked: string[];
    directMessageChannels: StoredDirectMessageChannel[];
}

/** Max number of messages kept per DM channel. */
const DM_HISTORY = 50;

function toUser(row: Record<string, unknown> | null): UserRow | null {
    if (!row) return null;
    return {
        ...(row as unknown as UserRow),
        silent: !!row.silent,
        acceptingFriendRequests: !!row.acceptingFriendRequests
    };
}

export async function getUserById(db: D1Database, id: string): Promise<UserRow | null> {
    return toUser(await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first());
}

export async function getUserByUsername(db: D1Database, username: string): Promise<UserRow | null> {
    return toUser(await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first());
}

/**
 * Creates a user using identifing fields
 * @returns `true` if user created and `false` if user could not be created.
 */
export async function createUser(db: D1Database, id: string, username: string, realName: string): Promise<boolean> {
    const res = await db.prepare(
        "INSERT OR IGNORE INTO users (username, id, realName, score, wins, silent, acceptingFriendRequests) VALUES (?, ?, ?, 0, 0, 0, 1)"
    ).bind(username, id, realName).run();
    return res.meta.changes > 0;
}

export async function updateUser(db: D1Database, username: string, fields: Partial<Pick<UserRow, "score" | "wins" | "silent" | "acceptingFriendRequests">>): Promise<void> {
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (keys.length == 0) return;
    const values = keys.map((k) => typeof fields[k] == "boolean" ? (fields[k] ? 1 : 0) : fields[k]);
    await db.prepare(
        `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(", ")}, updatedAt = CURRENT_TIMESTAMP WHERE username = ?`
    ).bind(...values, username).run();
}

/** Adds `delta` to a user's score and `winDelta` to their wins. */
export async function addToScore(db: D1Database, username: string, delta: number, winDelta: number = 0): Promise<void> {
    await db.prepare(
        "UPDATE users SET score = score + ?, wins = wins + ?, updatedAt = CURRENT_TIMESTAMP WHERE username = ?"
    ).bind(delta, winDelta, username).run();
}

/** Loads a user and everything about them that is sent to the client. */
export async function loadProfile(db: D1Database, user: UserRow): Promise<Profile> {
    const u = user.username;
    const [friends, friendRequests, requestedFriends, blocked, dms] = await db.batch([
        db.prepare("SELECT userB AS name FROM friends WHERE userA = ?1 UNION SELECT userA AS name FROM friends WHERE userB = ?1").bind(u),
        db.prepare("SELECT senderUsername AS name FROM friend_requests WHERE receiverUsername = ?").bind(u),
        db.prepare("SELECT receiverUsername AS name FROM friend_requests WHERE senderUsername = ?").bind(u),
        db.prepare("SELECT blocked AS name FROM blocked_users WHERE blocker = ?").bind(u),
        db.prepare("SELECT * FROM direct_messages WHERE sender = ?1 OR receiver = ?1 ORDER BY id").bind(u)
    ]);

    const names = (r: D1Result) => (r.results as { name: string }[]).map((row) => row.name);

    const channels: StoredDirectMessageChannel[] = [];
    for (const row of dms.results as { id: number; sender: string; receiver: string; content: string; timestamp: number; read: number }[]) {
        const other = row.sender == u ? row.receiver : row.sender;
        let channel = channels.find((c) => c.initiatedBy == other || c.receiver == other);
        if (!channel) {
            channel = { initiatedBy: row.sender, receiver: row.receiver, messages: [], messageIds: [] };
            channels.push(channel);
        }
        const message: Message = { from: row.sender, content: row.content, timestamp: row.timestamp, read: !!row.read };
        channel.messages.push(message);
        channel.messageIds.push(row.id);
    }

    return {
        user,
        friends: names(friends),
        friendRequests: names(friendRequests),
        requestedFriends: names(requestedFriends),
        blocked: names(blocked),
        directMessageChannels: channels
    };
}

// Friend management

export async function addFriend(db: D1Database, a: string, b: string): Promise<void> {
    await db.batch([
        // Removes requests and blocks in both directions
        db.prepare("DELETE FROM friend_requests WHERE (senderUsername = ?1 AND receiverUsername = ?2) OR (senderUsername = ?2 AND receiverUsername = ?1)").bind(a, b),
        db.prepare("DELETE FROM blocked_users WHERE (blocker = ?1 AND blocked = ?2) OR (blocker = ?2 AND blocked = ?1)").bind(a, b),
        db.prepare("INSERT INTO friends (userA, userB) VALUES (?, ?)").bind(a, b)
    ]);
}

/** Removes the friendship / incoming request between `user` and `other`, and blocks `other`. */
export async function unfriendAndBlock(db: D1Database, user: string, other: string): Promise<void> {
    await db.batch([
        db.prepare("INSERT INTO blocked_users (blocker, blocked) SELECT ?1, ?2 WHERE NOT EXISTS (SELECT 1 FROM blocked_users WHERE blocker = ?1 AND blocked = ?2)").bind(user, other),
        db.prepare("DELETE FROM friends WHERE (userA = ?1 AND userB = ?2) OR (userA = ?2 AND userB = ?1)").bind(user, other),
        db.prepare("DELETE FROM friend_requests WHERE senderUsername = ? AND receiverUsername = ?").bind(other, user)
    ]);
}

export async function unblock(db: D1Database, blocker: string, blocked: string): Promise<void> {
    await db.prepare("DELETE FROM blocked_users WHERE blocker = ? AND blocked = ?").bind(blocker, blocked).run();
}

export async function addFriendRequest(db: D1Database, sender: string, receiver: string): Promise<void> {
    await db.prepare("INSERT INTO friend_requests (senderUsername, receiverUsername) VALUES (?, ?)").bind(sender, receiver).run();
}

// Direct messages

export async function addDirectMessage(db: D1Database, sender: string, receiver: string, content: string): Promise<void> {
    await db.batch([
        db.prepare("INSERT INTO direct_messages (sender, receiver, content, timestamp) VALUES (?, ?, ?, ?)").bind(sender, receiver, content, Date.now()),
        // Only keeps the latest messages in the channel
        db.prepare(
            `DELETE FROM direct_messages WHERE id IN (
                SELECT id FROM direct_messages
                WHERE (sender = ?1 AND receiver = ?2) OR (sender = ?2 AND receiver = ?1)
                ORDER BY id DESC LIMIT -1 OFFSET ${DM_HISTORY}
            )`
        ).bind(sender, receiver)
    ]);
}

export async function markMessagesRead(db: D1Database, ids: number[]): Promise<void> {
    if (ids.length == 0) return;
    await db.prepare(`UPDATE direct_messages SET read = 1 WHERE id IN (${ids.map(() => "?").join(", ")})`).bind(...ids).run();
}

// Subscriptions

export async function addSubscription(db: D1Database, username: string, subscription: SubscriptionInformation): Promise<void> {
    await db.prepare(
        `INSERT INTO subscriptions (endpoint, expirationTime, p256dh, auth, username) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (endpoint) DO UPDATE SET expirationTime = excluded.expirationTime, p256dh = excluded.p256dh,
            auth = excluded.auth, username = excluded.username, updatedAt = CURRENT_TIMESTAMP`
    ).bind(subscription.endpoint, subscription.expirationTime ?? null, subscription.keys.p256dh, subscription.keys.auth, username).run();
}

export async function getSubscriptions(db: D1Database, username: string): Promise<SubscriptionInformation[]> {
    const { results } = await db.prepare("SELECT * FROM subscriptions WHERE username = ?").bind(username).all<{ endpoint: string; expirationTime: number | null; p256dh: string; auth: string }>();
    return results.map((r) => ({ endpoint: r.endpoint, expirationTime: r.expirationTime, keys: { p256dh: r.p256dh, auth: r.auth } }));
}

export async function removeSubscription(db: D1Database, endpoint: string): Promise<void> {
    await db.prepare("DELETE FROM subscriptions WHERE endpoint = ?").bind(endpoint).run();
}

// Misc

export async function getRankings(db: D1Database): Promise<{ name: string; score: number; wins: number }[]> {
    const { results } = await db.prepare("SELECT username AS name, score, wins FROM users").all<{ name: string; score: number; wins: number }>();
    return results;
}

/** Logs chat message. */
export async function logChatMessage(db: D1Database, username: string, realName: string, message: string): Promise<void> {
    await db.prepare("INSERT INTO chat_log (username, realName, message, timestamp) VALUES (?, ?, ?, ?)").bind(username, realName, message, Date.now()).run();
}
