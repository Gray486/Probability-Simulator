import { Player, PlayerKeys, Game as GameState, Move, JoinGameRes, GameData, GameResult } from "../types";
import { UserRow } from "./db";

/** Side effects the game needs from the outside world (the database). */
export interface GameHooks {
    /** Adds to a user's account score. */
    addToScore(username: string, delta: number): Promise<void>;
    /** Records a finished game in a user's statistics. */
    recordGame(username: string, points: number, won: boolean, score: number, busts: number): Promise<void>;
    /** Logs chat message. */
    logChatMessage(username: string, realName: string, message: string): Promise<void>;
    /** Called after a ranked game has been recorded, so the rankings can be reloaded. */
    refreshRankings(): Promise<void>;
    /** Called whenever the game state changes, so clients can be sent the new state. */
    onChange(): void;
}

/** The part of the game that is saved, so it survives the durable object being evicted. */
export type SavedGame = Pick<Game, "playerKeys" | "playerList" | "players" | "chat" | "game">;

/** Max length of a game name. */
const MAX_NAME_LENGTH = 7;

/** Range of scores a lobby can be played to. */
export const MIN_POINTS_TO_WIN = 25;
export const MAX_POINTS_TO_WIN = 500;

const ALL_NUMBERS = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const newGameState = (): GameState => ({
    numbersLeft: ALL_NUMBERS(),
    thisSpin: -1,
    lastSpin: -1,
    started: false,
    spinNumber: 0,
    points: 0,
    result: "none",
    round: 1,
    canJoin: true,
    lastWinner: "",
    gameNumber: 0,
    lastResults: [],
    lastRounds: 0,
    pointsToWin: 100
});

function randomKey(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class Game {
    /** Game keys associated with specific players (by gameName) to validate who they are. */
    playerKeys: PlayerKeys = {};
    /** List of players by gameName. */
    playerList: string[] = [];
    players: Player[] = [];
    /** Array of pre-formmated chat messages. */
    chat: string[] = [];
    /** Timer that auto starts the game once enough players are ready. */
    private startTimer: ReturnType<typeof setTimeout> | null = null;
    /**
     * Timers that move the game along (next spin, next round, move deadline...). They are all
     * cancelled whenever the game moves to a new turn, round or ends, so a stale timer from an
     * earlier turn or game can never fire into the current one.
     */
    private flowTimers = new Set<ReturnType<typeof setTimeout>>();
    game: GameState = newGameState();
    /** Wether or not the server should send game data to clients. */
    sendData: boolean = true;
    /** Wether or not a user can make a move right now. */
    private canGo: boolean = true;
    /** Copy of the game data from the last time sending was allowed, see {@link visibleData}. */
    private allowedData: GameData | null = null;

    /**
     * @param ranked Whether finished games change account rank points. Private lobbies are unranked,
     * so friends can't farm points off each other.
     */
    constructor(private hooks: GameHooks, readonly ranked: boolean = true) { }

    /**
     * The game data clients are allowed to see. While players are choosing a move this stays
     * frozen at the moment choosing started, so nobody can see what the others picked.
     */
    visibleData(): GameData {
        if (this.sendData || !this.allowedData) {
            this.allowedData = structuredClone({ playerList: this.playerList, players: this.players, game: this.game });
        }
        return this.allowedData;
    }

    /** Whether nobody is in the game. */
    get empty(): boolean {
        return this.players.length == 0;
    }

    /** Changes the score needed to win. Only allowed before the game starts. */
    setPointsToWin(points: number): boolean {
        if (this.game.started || !Number.isInteger(points) || points < MIN_POINTS_TO_WIN || points > MAX_POINTS_TO_WIN) return false;
        this.game.pointsToWin = points;
        return true;
    }

    /** Cancels every timer, used before a lobby is thrown away. */
    stop(): void {
        this.clearFlowTimers();
        this.clearStartTimer();
    }

    save(): SavedGame {
        const { playerKeys, playerList, players, chat, game } = this;
        return { playerKeys, playerList, players, chat, game };
    }

    /** Restores a saved game. A game that was mid-match goes back to the lobby, since its timers are gone. */
    restore(saved: SavedGame): void {
        Object.assign(this, saved);
        // Fills in fields added since the game was saved
        this.game = { ...newGameState(), ...saved.game };
        for (const player of this.players) player.busts ??= 0;
        if (this.game.started) {
            this.resetGame();
            for (const player of this.players) {
                this.resetPlayer(player);
            }
        }
    }

    /** Adds user to game and returns game key if successful. */
    joinGame(gameName: string, user: UserRow, allowedToJoin: boolean): JoinGameRes {
        if (!allowedToJoin) {
            return { status: "error", msg: "Cannot join game right now." };
        }

        if (this.players.findIndex((a: Player) => a.username == user.username) > -1) {
            return { status: "error", msg: "User already in game." };
        }

        if (!gameName) {
            return { status: "error", msg: "No username field." };
        }

        if (gameName.length > MAX_NAME_LENGTH) {
            return { status: "error", msg: `Name must be at most ${MAX_NAME_LENGTH} characters.` };
        }

        if (this.playerList.includes(gameName)) {
            return { status: "error", msg: "Username taken." };
        }

        // Adds user to lists
        this.playerList.push(gameName)
        this.players.push({
            gameName: gameName,
            realName: user.realName,
            username: user.username,
            score: 0,
            ready: false,
            freeSpin: true,
            alive: true,
            move: "none",
            lastMove: "",
            strikes: 0,
            busts: 0
        })

        // Generates a new key for this users session
        const newKey: string = randomKey();

        this.playerKeys[gameName] = newKey;

        return { status: "success", key: newKey }
    }

    /**
     * Vote to start the game for specified user.
     * @param username Player's account username.
     */
    voteStartGame(username: string): void {
        const playerIndex: number = this.players.findIndex((a: Player) => a.username == username);
        if (playerIndex > -1) {
            this.players[playerIndex].ready = true;
        }

        const numberOfReady: number = this.players.filter((a) => a.ready == true).length;

        //FIXME: Change number of ready > 1
        if (numberOfReady == this.playerList.length && numberOfReady > 0) {
            this.startGame()
            return;
        }

        this.clearStartTimer()
        this.startTimer = setTimeout(() => {
            this.startTimer = null;
            if (this.players.filter((a) => a.ready == true).length > 1) {
                this.startGame()
            }
        }, 18000)
    }

    private startGame(): void {
        if (this.game.started) return;
        this.clearStartTimer()
        this.game.started = true;
        this.game.canJoin = false;
        this.newTurn()
    }

    private clearStartTimer(): void {
        if (this.startTimer) clearTimeout(this.startTimer)
        this.startTimer = null;
    }

    /** Runs `fn` after `ms`, unless the game moves on first (see {@link flowTimers}). */
    private later(fn: () => void, ms: number): void {
        const timer = setTimeout(() => {
            this.flowTimers.delete(timer);
            fn();
        }, ms);
        this.flowTimers.add(timer);
    }

    private clearFlowTimers(): void {
        for (const timer of this.flowTimers) clearTimeout(timer);
        this.flowTimers.clear();
    }

    /**
     * Make a move for the specified user .
     * @returns `true` if successful and `false` if possible cheating or error has occured.
     */
    makeMove(move: Move, gameName: string): boolean {
        const player: Player | undefined = this.players.find(a => a.gameName == gameName)
        if (!player) return false;

        switch (move) {
            case "bank":
                player.score += this.game.points
                player.alive = false;
                player.move = "bank";
                break;
            case "freeSpin":
                if (player.freeSpin) {
                    player.freeSpin = false;
                    player.move = "freeSpin";
                } else {
                    player.move = "none";
                }
                break;
            case "higher":
                player.move = "higher";
                break;
            case "lower":
                player.move = "lower";
                break;
            default:
                player.move = "none";
                break;
        }

        if (!this.game.started || !this.canGo) {
            player.move = "none"
        }

        if (player.move == "none") {
            return false;
        }

        player.strikes = 0;

        const alivePlayers = this.players.filter((a: Player) => a.alive)

        if (alivePlayers.length && this.players.filter((a: Player) => a.alive && a.move !== "none").length == alivePlayers.length) {
            this.newTurn()
        }

        if (alivePlayers.length == 0) {
            this.newRound()
        }

        return true;
    }

    /** Triggers a new turn / spin. */
    private newTurn(): void {
        const { game, players } = this;
        this.canGo = false;
        this.sendData = true;
        game.lastSpin = game.thisSpin

        // Cancels the previous turn's timers
        this.clearFlowTimers()

        const choices: number[] = game.numbersLeft;

        if (choices.length == 1) {
            game.points += choices[0]
            for (let i = 0; i < players.length; i++) {
                if (players[i].alive) {
                    players[i].score += game.points
                    players[i].freeSpin = true;
                }
            }
            this.newRound()
            return;
        }

        const spinIndex: number = Math.floor(Math.random() * (choices.length - 1)) + 1

        game.thisSpin = choices[spinIndex]
        game.spinNumber++
        game.points += game.thisSpin;
        game.numbersLeft.splice(spinIndex, 1)
        game.result = game.thisSpin > game.lastSpin ? "higher" : "lower";

        // Assigns last moves to players and unalives them if neccicary
        for (let i = 0; i < players.length; i++) {
            if (players[i].alive) {
                // If they choose the wrong move and this isn't the first turn of the round
                if (players[i].move != game.result && players[i].move != "freeSpin" && game.numbersLeft.length != 12) {
                    players[i].alive = false
                    players[i].busts++
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
            this.later(() => {
                this.newRound()
            }, 8000)
            this.hooks.onChange()
            return;
        }

        this.later(() => {
            this.canGo = true;
            this.sendData = false;
            this.hooks.onChange()
        }, 2000)

        this.hooks.onChange()

        // Runs after 29 seconds, strikes and banks players who didn't move
        this.later(() => {
            const { players } = this;

            // If there are no players, end the game
            if (players.length == 0) {
                this.endGame()
                return;
            }

            for (const player of [...players]) {
                // If they didn't move and they are alive, then they get banked and striked
                if (player.move == "none" && player.alive) {
                    player.score += game.points
                    player.strikes++
                    player.alive = false;
                    player.move = "bank";
                }

                // Removes player after 3 strikes
                if (player.strikes >= 3) {
                    this.removePlayer(player.username, this.playerKeys[player.gameName])
                }
            }

            // If there are no players, end the game
            if (players.length == 0) {
                this.endGame()
                return;
            }

            // If everybody is dead, then new round starts
            if (players.filter(a => a.alive).length == 0) {
                this.newRound()
                return;
            }

            // If somebody is alive, new turn starts
            this.newTurn()
        }, 29000)
    }

    /** Triggers a new round. */
    private newRound(): void {
        const { game, players } = this;

        this.clearFlowTimers()

        // If somebody won, end the game
        if (players.filter(a => a.score >= game.pointsToWin).length > 0) {
            this.endGame()
            return;
        }

        // If there are no players, end the game
        if (players.length == 0) {
            this.endGame()
            return;
        }

        this.sendData = true;

        game.points = 0;
        game.numbersLeft = ALL_NUMBERS();
        game.thisSpin = -1;
        game.lastSpin = -1;
        game.result = "none";

        for (let i = 0; i < players.length; i++) {
            players[i].alive = true;
            players[i].move = "none"
            players[i].lastMove = "none";
        }

        game.round++

        this.later(() => {
            this.newTurn()
        }, 5000)

        this.hooks.onChange()
    }

    /**
     * Sends a message to the chat.
     * @param message The message to send.
     * @param user The user sending the message, used for the chatlog.
     * @param playerName The name that will appear in the chat.
     */
    sendMessage(message: string, user: UserRow, playerName?: string): void {
        // Removes 50th chat message to make some space
        if (this.chat.length > 50) {
            this.chat.splice(0, 1)
        }

        if (message.length > 50) {
            message = message.slice(0, 50);
        }

        if (!playerName) {
            playerName = user.username
        }

        this.chat.push(`${playerName}: ${message}`)

        // Logs chat message to the database
        this.hooks.logChatMessage(user.username, user.realName, message).catch(console.error)
    }

    /**
     * Removes a player from the game.
     * @param username The player's / user's username.
     * @param key The specified player's game key.
     */
    removePlayer(username: string, key: string): void {
        const playerIndex: number = this.players.findIndex((a: Player) => a.username == username);

        // Checks if player's game key is correct and player exists
        if (playerIndex < 0 || this.playerKeys[this.players[playerIndex].gameName] != key) {
            return;
        }

        const gameName = this.players[playerIndex].gameName;
        const leftMidGame = this.game.started;

        // Removes player
        this.players.splice(playerIndex, 1)
        this.playerList.splice(this.playerList.indexOf(gameName), 1)
        delete this.playerKeys[gameName]

        if (this.players.length == 0) {
            this.endGame()
        }

        // Removes 20 points if user leaves mid-game
        if (leftMidGame && this.ranked) {
            this.hooks.addToScore(username, -20).catch(console.error)
        }
    }

    /** Triggers the end of the game. */
    private async endGame(): Promise<void> {
        const { game, players } = this;
        const wasStarted = game.started;
        const rounds = game.round;

        this.clearFlowTimers()
        this.clearStartTimer()

        // Setup next game
        this.resetGame();

        // Sort players by score, needed to award points
        players.sort((a: Player, b: Player) => b.score - a.score);

        const results: GameResult[] = players.map((player, i) => ({
            gameName: player.gameName,
            username: player.username,
            score: player.score,
            // Solo games don't award points (the formula divides by zero with one player)
            points: this.ranked && players.length > 1 ? Math.round(20 - (40 * i) / (players.length - 1)) : 0,
            busts: player.busts
        }));

        for (const player of players) {
            this.resetPlayer(player);
        }

        // Ending in the lobby (everybody left before it started) isn't a finished game
        if (!wasStarted) {
            this.hooks.onChange()
            return;
        }

        // If there is a player left, they won the game
        game.lastWinner = players[0]?.gameName ?? "";
        game.lastResults = results;
        game.lastRounds = rounds;
        game.gameNumber++;

        this.hooks.onChange()

        // Updates every player's account score, wins and statistics
        if (!this.ranked) return;
        await Promise.all(results.map((r, i) => this.hooks.recordGame(r.username, r.points, i == 0, r.score, r.busts))).catch(console.error);
        await this.hooks.refreshRankings()
    }

    private resetGame(): void {
        const { game } = this;
        this.sendData = true;
        this.canGo = true;
        game.canJoin = true;
        game.points = 0;
        game.numbersLeft = ALL_NUMBERS();
        game.thisSpin = -1;
        game.lastSpin = -1;
        game.round = 1;
        game.spinNumber = 0;
        game.started = false;
        game.result = "none";
    }

    private resetPlayer(player: Player): void {
        player.alive = true;
        player.move = "none";
        player.lastMove = "none";
        player.freeSpin = true;
        player.score = 0;
        player.ready = false;
        player.strikes = 0;
        player.busts = 0;
    }

    /** Removes a player that is waiting in the lobby, e.g. because they closed the page. */
    removeLobbyPlayer(username: string): void {
        if (this.game.started) return;
        const player = this.players.find((a) => a.username == username);
        if (player) this.removePlayer(username, this.playerKeys[player.gameName]);
    }
}
