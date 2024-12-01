import { logChatMessage } from "./files";
import { Player, User, PlayerKeys, Timers, Game, Move, isMove } from "./types";
import * as crypto from "node:crypto";

export let playerKeys: PlayerKeys;
export let playerList: string[];
export let players: Player[];
export let chat: string[] = [""];
let timers: Timers;
export let game: Game = {
    numbersLeft: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    thisSpin: -1,
    lastSpin: -1,
    started: false,
    spinNumber: 0,
    points: 0,
    higher: false,
    round: 1,
    canJoin: true,
    lastWinner: ""
};

// Adds user to game
export function joinGame(gameName: string, user: User, allowedToJoin: boolean): {status: "error", msg: string} | {status: "success", key: string} {
    if (!allowedToJoin) {
        return {status: "error", msg: "Cannot join game right now." };
    }
    
    if (players.findIndex((a: any) => a.username == user.username) > 0) {
        return {status: "error", msg: "User already in game." };
    }

    if (!gameName) {
        return {status: "error", msg: "No username field." };
    }
            
    if (playerList.includes(gameName)) {
        return {status: "error", msg: "Username taken." };
    }

    // Adds user to lists
    playerList.push(gameName)
    players.push({
        gameName: gameName,
        realName: user.name,
        username: user.username,
        score: 0,
        ready: false,
        freeSpin: true,
        alive: true,
        move: "none",
        lastMove: "",
        strikes: 0
    })

    // Generates a new key for this users session
    let newKey: string = crypto.randomBytes(32).toString('hex');

    playerKeys[gameName] = newKey;

    return {status: "success", key: newKey}
}

// Users can vote to start the game
export function voteStartGame(gameName) {
    const playerIndex: number = players.findIndex((a: Player) => a.gameName == gameName);
    if (playerIndex > 0) {
        players[playerIndex].ready = true;
    }

    let numberOfReady: number = players.filter((a) => a.ready == true).length;

    // TODO: Work on push notifications
    // if (numberOfReady == 1) {
    //     sendPushNotificaiton("Game about to start!", `${user.name} just voted to start a game!`)
    // }

    if (numberOfReady == playerList.length && numberOfReady > 1 && !game.started) {
        game.started = true;
        game.canJoin = false;
        generateNumber()
    }

    if (timers.start) {
        clearTimeout(timers.start)
    }

    timers.start = setTimeout(() => {
        if (!game.started && players.filter((a) => a.ready == true).length > 1) {
            game.started = true;
            game.canJoin = false;
            generateNumber()
        }
    }, 18000)
}

// Users can make moves in the game
export function makeMove(move: Move, gameName: string) {
    let playerIndex = players.findIndex(a => a.gameName == gameName)

    if (!isMove(move)) {
        move = "none";
    }

    switch (move) {
        case "bank":
            players[playerIndex].score += game.points
            players[playerIndex].alive = false;
            players[playerIndex].move = "bank";
            break;
        case "freeSpin":
            if (players[playerIndex].freeSpin == true) {
                players[playerIndex].freeSpin = false;
                players[playerIndex].move = "freeSpin";
            } else {
                players[playerIndex].move = "none";
            }
            break;
        case "higher":
            players[playerIndex].move = "higher";
            break;
        case "lower":
            players[playerIndex].move = "lower";
            break;
        default:
            players[playerIndex].move = "none";
            break;
    }

    if (!game.started || !canGo) {
        players[playerIndex].move = "none"
    }

    if (players[playerIndex].move == "none") {
        return false;
    }

    players[playerIndex].strikes = 0;

    let alivePlayers = players.filter(a => a.alive)

    if (alivePlayers.length && players.filter((a: Player) => a.alive && a.move !== "none").length == alivePlayers.length) {
        generateNumber()
    }

    if (alivePlayers.length == 0) {
        newRound()
    }

    return true;
}

// Sends a message to the chat
export function sendMessage(message: string, username: string | undefined, realName: string) {
    if (chat.length > 50) {
        chat.splice(0, 1)
    }

    if (!username) {
        username = "???"
    }

    chat.push(`${username}: ${message}`)

    logChatMessage(username, realName, message)
}