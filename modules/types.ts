// Account Types

export type User = {
    username: string,
    name: string,
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

export type Player = {
    gameName: string,
    realName: string,
    username: string,
    score: number,
    ready: boolean,
    freeSpin: boolean,
    alive: boolean,
    move: Move,
    lastMove: Move,
    strikes: number
}

const move = ["freeSpin", "higher", "lower", "none", "bank"] as const;
export type Move = (typeof move)[number];

export function isMove(x: any): x is Move {
    return move.includes(x);
}

export type PlayerKeys = {
    [key: string]: string
}

export type Timers = {
    start: NodeJS.Timeout
}

export type Game = {
    numbersLeft: number[],
    thisSpin: number,
    lastSpin: number,
    started: boolean,
    spinNumber: number,
    points: number,
    higher: boolean,
    round: number,
    canJoin: boolean,
    lastWinner: string
}