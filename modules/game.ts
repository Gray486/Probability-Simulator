import { getUserDBAsync, logChatMessage, setUserDB } from "./files";
import { Player, User, PlayerKeys, Game, Move, Ranking, GameTimers, JoinGameRes } from "./types";
import * as crypto from "node:crypto";

/** Game keys associated with specific players (by gameName) to validate who they are. */
export let playerKeys: PlayerKeys = {};
/** List of players by gameName. */
export let playerList: string[] = [];
export let players: Player[] = [];
/** Array of pre-formmated chat messages. */
export let chat: string[] = [];
let timers: GameTimers = {
    start: null,
    play: null
};
export let game: Game = {
    numbersLeft: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    thisSpin: -1,
    lastSpin: -1,
    started: false,
    spinNumber: 0,
    points: 0,
    result: "none",
    round: 1,
    canJoin: true,
    lastWinner: ""
};
/** Wether or not the server should send game data to clients. */
export let sendData: boolean = true;
/** Wether or not a user can make a move right now. */
let canGo: boolean = true;
/** Unsorted rankings of users. */
export let rankings: Ranking[];

/** Adds user to game and returns game key if successful. */
export function joinGame(gameName: string, user: User, allowedToJoin: boolean): JoinGameRes {
    if (!allowedToJoin) {
        return {status: "error", msg: "Cannot join game right now." };
    }
    
    if (players.findIndex((a: Player) => a.username == user.username) > -1) {
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
        realName: user.realName,
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

/** 
 * Vote to start the game for specified user. 
 * @param username Player's account username.
 */
export function voteStartGame(username: string): void {
    const playerIndex: number = players.findIndex((a: Player) => a.username == username);
    if (playerIndex > -1) {
        players[playerIndex].ready = true;
    }

    let numberOfReady: number = players.filter((a) => a.ready == true).length;

    if (numberOfReady == playerList.length && numberOfReady > 1 && !game.started) {
        game.started = true;
        game.canJoin = false;
        newTurn()
    }

    if (timers.start) {
        clearTimeout(timers.start)
    }

    timers.start = setTimeout(() => {
        if (!game.started && players.filter((a) => a.ready == true).length > 1) {
            game.started = true;
            game.canJoin = false;
            newTurn()
        }
    }, 18000)
}

/**
 * Make a move for the specified user .
 * @returns "true" if successful and "false" if possible cheating or error has occured.
 */
export function makeMove(move: Move, gameName: string): boolean {
    let playerIndex = players.findIndex(a => a.gameName == gameName)

    switch (move) {
        case "bank":
            players[playerIndex].score += game.points
            players[playerIndex].alive = false;
            players[playerIndex].move = "bank";
            break;
        case "freeSpin":
            if (players[playerIndex].freeSpin) {
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
        newTurn()
    }

    if (alivePlayers.length == 0) {
        newRound()
    }

    return true;
}

/** Triggers a new turn / spin. */
function newTurn(): void {
    canGo = false;
    sendData = true;
    game.lastSpin = game.thisSpin

    // Clear the play timer
    if (timers.play) {
        clearTimeout(timers.play);
    }

    let choices: number[] = game.numbersLeft;

    if (choices.length == 1) {
        game.points += choices[0]
        for (let i = 0; i < players.length; i++) {
            if (players[i].alive) {
                players[i].score += game.points
                players[i].freeSpin = true;
            }
        }
        newRound()
        return;
    }

    let spinIndex: number = Math.floor(Math.random() * (choices.length - 1)) + 1

    game.thisSpin = choices[spinIndex]
    game.spinNumber++
    game.points += game.thisSpin;
    game.numbersLeft.splice(spinIndex, 1)
    game.result = game.thisSpin > game.lastSpin ? "higher" : "lower";

    // Assigns last moves to players and unalives them if neccicary
    for (let i = 0; i < players.length; i++) {
        if (players[i].alive) {
            // If they choose the wrong move and this isn't the first turn of the round
            if (players[i].move != game.result && game.numbersLeft.length != 12) {
                players[i].alive = false
            }

            players[i].lastMove = players[i].move
        } else if (players[i].move == "bank" || players[i].lastMove == "bank") {
            players[i].lastMove = "bank"
        } else {
            players[i].lastMove = "stillOut"
        }

        players[i].move = "none";
    }

    // If everybody is unalived, then we start new round
    // Otherwise we let them choose a move
    if (players.filter((a: Player) => a.alive).length <= 0) {
        setTimeout(function () {
            newRound()
        }, 8000)
    } else {
        setTimeout(function () {
            canGo = true;
            sendData = false;
        }, 2000)
    }

    // Runs after 29 seconds, strikes and banks players who didn't move
    timers.play = setTimeout(function () {
        // If there are no players, end the game
        if (players.length == 0) {
            endGame()
            return;
        }

        for (let i: number = 0; i < players.length; i++) {
            // If they didn't move and they are alive, then they get banked and striked
            if (players[i].move == "none" && players[i].alive) {
                players[i].score += game.points
                players[i].strikes++
                players[i].alive = false;
                players[i].move = "bank";
            }

            // Removes player after 3 strikes
            if (players[i].strikes >= 3) {
                removePlayer(players[i].username, playerKeys[players[i].gameName])
            }
        }

        // If there are no players, end the game
        if (players.length == 0) {
            endGame()
            return;
        }

        // If everybody is dead, then new round starts
        if (players.filter(a => a.alive).length == 0) {
            newRound()
            return;
        }

        // If somebody is alive, new turn starts
        newTurn()
    }, 29000)
}

/** Triggers a new round. */
function newRound(): void {
    // Clear the play timer
    if (timers.play) {
        clearTimeout(timers.play)
    }

    // If somebody won, end the game
    if (players.filter(a => a.score >= 100).length > 0) {
        endGame()
        return;
    }

    // If there are no players, end the game
    if (players.length == 0) {
        endGame()
        return;
    }

    sendData = true;

    game.points = 0;
    game.numbersLeft = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    game.thisSpin = -1;
    game.lastSpin = -1;
    game.result = "none";

    for (let i = 0; i < players.length; i++) {
            players[i].alive = true;
            players[i].move = "none"
            players[i].lastMove = "none";
    }

    game.round++

    setTimeout(function () {
        newTurn()
    }, 5000)
}

/** 
 * Sends a message to the chat.
 * @param message The message to send.
 * @param username The name that will appear in the chat.
 * @param realName The name that will appear in the chatlog.
 */
export function sendMessage(message: string, username: string | undefined, realName: string): void {

    // Removes 50th chat message to make some space
    if (chat.length > 50) {
        chat.splice(0, 1)
    }

    if (message.length > 50) {
        message = message.slice(0, 50);
    }

    if (!username) {
        username = "???"
    }

    chat.push(`${username}: ${message}`)

    // Logs chat message to json file
    logChatMessage(username, realName, message)
}

/** 
 * Removes a player from the game.
 * @param username The player's / user's username.
 * @param key The specified player's game key.
 */
export function removePlayer(username: string, key: string) {

    const playerIndex: number = players.findIndex((a: Player) => a.username == username);

    if (playerIndex < 0) {
        return;
    }

    const gameName = players[playerIndex].gameName;

    // Checks if player's game key is correct and player exists
    if (playerIndex > -1 && playerKeys[gameName] == key) {

        // Removes 50 points if user leaves mid-game
        if (game.started) {
            getUserDBAsync((userDB) => {
                const userIndex = userDB.findIndex((user) => user.username == username);
                if (userIndex != -1) {
                    userDB[userIndex].score -= 50;
                    setUserDB(userDB)
                }
            })
        }

        // Removes player
        players.splice(playerIndex, 1)
        playerList.splice(playerList.indexOf(gameName), 1)
        delete playerKeys[gameName]
    }

    if (players.length == 0) {
        endGame()
    }
}

/** Triggers the end of the game. */
function endGame(): void {
    if (timers.play) {
        clearTimeout(timers.play)
    }

    // Setup next game
    sendData = true;
    game.canJoin = true;
    game.points = 0;
    game.numbersLeft = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    game.thisSpin = -1;
    game.lastSpin = -1;
    game.round = 0;
    game.spinNumber = 0;
    game.started = false;
    game.result = "none";

    // Sort players by score, needed to award points
    players.sort((a: Player, b: Player) => b.score - a.score);

    getUserDBAsync((updatedUserDB) => {

        // For every player, update their score, and add one to the winning player's win tally
        for (let i = 0; i < players.length; i++) {
            players[i].alive = true;
            players[i].move = "none";
            players[i].lastMove = "none";
            players[i].freeSpin = true;
            players[i].score = 0;
            players[i].ready = false;
            players[i].strikes = 0;

            let userIndex = updatedUserDB.findIndex((a: User) => a.username == players[i].username);

            if (i == 0) {
                updatedUserDB[userIndex].wins++;
            }

            updatedUserDB[userIndex].score += Math.round(20 - (40 * i) / (players.length - 1));
        }

        setUserDB(updatedUserDB);
    });

    // If there is a player left, they won the game
    if (players.length > 0) {
        game.lastWinner = players[0].gameName;
    }

    setRankings()
}

/** Used to set the rankings after a game. */
export function setRankings(): void {
    getUserDBAsync((userDB) => {
        rankings = [];
        for (let i = 0; i < userDB.length; i++) {
            let user: User = userDB[i]
            rankings.push({
                name: user.username,
                score: user.score,
                wins: user.wins
            })
        }
    });
}