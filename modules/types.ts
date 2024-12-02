// Account Types

export type User = {
    /** Name on google account. */
    realName: string,
    /** Username based on name. */
    username: string,
    /** "sub" on google account. */
    id: string,
    score: number,
    wins: number
}

// File Types

export type KeysFile = {
    G_CLIENT_ID: string,
    VAPID: {
        SUBJECT: string,
        PUBLIC_KEY: string,
        PRIVATE_KEY: string
    },
    JWT_SECRET: string
}

export type ChatLogFile = {
    username: string, 
    realName: string, 
    message: string
}
 
// Routing Types

export type UserLoginRes = {
    success: true, 
    status: 200, 
    token: string
} | {
    success: false, 
    status: number, 
    message: string
}

// Game Types

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

/** Data about the game that is send to clients. */
export type GameData = {
    playerList: string[],
    players: Player[],
    game: Game,
    rankings: Ranking[]
}

/** Data about the game that is send to clients. */
export type SendData = GameData & {
    chat: string[],
    live: boolean
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