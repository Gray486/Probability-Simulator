-- Mirrors the tables Sequelize created in storage/database.db so old rows can be imported as-is.

CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    realName TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    lastInvite INTEGER,
    silent INTEGER NOT NULL DEFAULT 0,
    acceptingFriendRequests INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS users_id ON users (id);

CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userA TEXT NOT NULL REFERENCES users (username),
    userB TEXT NOT NULL REFERENCES users (username),
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS friends_userA ON friends (userA);
CREATE INDEX IF NOT EXISTS friends_userB ON friends (userB);

CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderUsername TEXT NOT NULL REFERENCES users (username),
    receiverUsername TEXT NOT NULL REFERENCES users (username),
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS friend_requests_sender ON friend_requests (senderUsername);
CREATE INDEX IF NOT EXISTS friend_requests_receiver ON friend_requests (receiverUsername);

CREATE TABLE IF NOT EXISTS blocked_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker TEXT NOT NULL REFERENCES users (username),
    blocked TEXT NOT NULL REFERENCES users (username),
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS blocked_users_blocker ON blocked_users (blocker);

CREATE TABLE IF NOT EXISTS subscriptions (
    endpoint TEXT PRIMARY KEY,
    expirationTime INTEGER,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    username TEXT NOT NULL REFERENCES users (username),
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subscriptions_username ON subscriptions (username);

-- Replaces the in-memory DM list, so DMs now survive restarts.
CREATE TABLE IF NOT EXISTS direct_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL REFERENCES users (username),
    receiver TEXT NOT NULL REFERENCES users (username),
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS direct_messages_pair ON direct_messages (sender, receiver);
CREATE INDEX IF NOT EXISTS direct_messages_receiver ON direct_messages (receiver);

-- Replaces storage/chatlog.json.
CREATE TABLE IF NOT EXISTS chat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    realName TEXT,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);
