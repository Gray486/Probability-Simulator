export type User = {
        /** Name on google account. */
        realName: string,
        /** Unique username based on realName. */
        username: string,
        /** "sub" on google account. */
        id: string,
        friends: string[],
        /** The usernames of users that have requested to friend this user. */
        friendRequests: string[],
        /** The list of users that have been blocked. */
        blockedUsers: string[],
        score: number,
        wins: number,
        /** Whether user is in silent mode. */
        silent: boolean,
        lastInvite: number | null,
        acceptingFriendRequests: boolean
}

export type DirectMessageChannel = {
        /** The username of the person that initiated the DM channel. */
        initiatedBy: string,
        /** The username of the user the DM channel is with. */
        receiver: string,
        /** The list of messages in the DM channel. */
        messages: Message[],
}

export type Message = {
        from: string,
        content: string,
        timestamp: number,
        read: boolean
}

export type KeysFile = {
        G_CLIENT_ID: string,
        VAPID: {
                SUBJECT: string,
                PUBLIC_KEY: string,
                PRIVATE_KEY: string
        },
        JWT_SECRET: string
}

export type ChatLog = {
        username: string,
        realName: string,
        message: string
}

export type SubscriptionInformation = {
        endpoint: string,
        expirationTime?: null | number,
        keys: {
                p256dh: string,
                auth: string
        }
        username: string
}

export type UserLoginRes = {
        success: true,
        status: 200,
        token: string
} | {
        success: false,
        status: number,
        message: string
}

/** Player only used for single game. */
export type Player = {
        /** Name chosen at game start. */
        gameName: string,
        /** Name on google account. */
        realName: string,
        /** Username based on realName. */
        username: string,
        score: number,
        ready: boolean,
        freeSpin: boolean,
        alive: boolean,
        move: Move,
        lastMove: LastMove,
        /** Number of times a player has not made a move in the given time. */
        strikes: number
}

export type Move = "freeSpin" | "higher" | "lower" | "none" | "bank";
type LastMove = Move | "stillOut" | ""

export type PlayerKeys = {
        [key: string]: string
}

export type GameTimers = {
        start: NodeJS.Timeout | null,
        play: NodeJS.Timeout | null
}

export type Game = {
        numbersLeft: number[],
        thisSpin: number,
        lastSpin: number,
        started: boolean,
        spinNumber: number,
        /** Points accumulated this round. */
        points: number,
        result: "higher" | "lower" | "none";
        round: number,
        /** Wether or not players can join the game right now. */
        canJoin: boolean,
        /** Winner of last game. */
        lastWinner: string
}

/** Data about the game. */
export type GameData = {
        playerList: string[],
        players: Player[],
        game: Game,
        rankings: Ranking[]
}

/** Data that is sent to clients about the game plus extra information. */
export type SendData = GameData & {
        /** In game chat */
        chat: string[],
        /** Whether game specific data is being live updated. (false when guessing is occuring) */
        live: boolean,
        /** Information about the user. */
        me: {
                name: string,
                username: string
                friendRequests: string[],
                friends: string[],
                blockedUsers: string[],
                directMessageChannels: DirectMessageChannel[],
                silent: boolean,
                acceptingFriendRequests: boolean
        }
}

export type Ranking = {
        name: string,
        score: number,
        wins: number
}

/**
 * Return value for joinGame function.
 */
export type JoinGameRes = {
        status: "error",
        msg: string
} | {
        status: "success",
        key: string
}

export type LastOnline = {
        [key: string]: number
}
