import { Player, PlayerKeys, Game as GameState, Move, Ranking, GameTimers, JoinGameRes, GameData } from "../types";
import { UserRow } from "./db";

/** Side effects the game needs from the outside world (the database). */
export interface GameHooks {
    /** Adds to a user's account score / wins. */
    addToScore(username: string, delta: number, winDelta?: number): Promise<void>;
    /** Logs chat message. */
    logChatMessage(username: string, realName: string, message: string): Promise<void>;
    /** Loads the rankings of every user. */
    getRankings(): Promise<Ranking[]>;
    /** Called whenever the game state changes, so clients can be sent the new state. */
    onChange(): void;
}

/** The part of the game that is saved, so it survives the durable object being evicted. */
export type SavedGame = Pick<Game, "playerKeys" | "playerList" | "players" | "chat" | "game">;

/** Max length of a game name. */
const MAX_NAME_LENGTH = 7;

const ALL_NUMBERS = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

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
    private timers: GameTimers = {
        start: null,
        play: null
    };
    game: GameState = {
        numbersLeft: ALL_NUMBERS(),
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
    sendData: boolean = true;
    /** Wether or not a user can make a move right now. */
    private canGo: boolean = true;
    /** Unsorted rankings of users. */
    rankings: Ranking[] = [];

    constructor(private hooks: GameHooks) { }

    /** Snapshot of the game data that can be sent to clients. */
    get data(): GameData {
        return {
            playerList: this.playerList,
            players: this.players,
            game: this.game,
            rankings: this.rankings
        };
    }

    save(): SavedGame {
        const { playerKeys, playerList, players, chat, game } = this;
        return { playerKeys, playerList, players, chat, game };
    }

    /** Restores a saved game. A game that was mid-match goes back to the lobby, since its timers are gone. */
    restore(saved: SavedGame): void {
        Object.assign(this, saved);
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
            strikes: 0
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
        if (numberOfReady == this.playerList.length && numberOfReady > 0 && !this.game.started) {
            this.game.started = true;
            this.game.canJoin = false;
            this.newTurn()
        }

        if (this.timers.start) {
            clearTimeout(this.timers.start)
        }

        this.timers.start = setTimeout(() => {
            if (!this.game.started && this.players.filter((a) => a.ready == true).length > 1) {
                this.game.started = true;
                this.game.canJoin = false;
                this.newTurn()
            }
        }, 18000)
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

        // Clear the play timer
        if (this.timers.play) {
            clearTimeout(this.timers.play);
        }

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
            setTimeout(() => {
                this.newRound()
            }, 8000)
        } else {
            setTimeout(() => {
                this.canGo = true;
                this.sendData = false;
                this.hooks.onChange()
            }, 2000)
        }

        this.hooks.onChange()

        // Runs after 29 seconds, strikes and banks players who didn't move
        this.timers.play = setTimeout(async () => {
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
                    await this.removePlayer(player.username, this.playerKeys[player.gameName])
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

        // Clear the play timer
        if (this.timers.play) {
            clearTimeout(this.timers.play)
        }

        // If somebody won, end the game
        if (players.filter(a => a.score >= 100).length > 0) {
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

        setTimeout(() => {
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
    async removePlayer(username: string, key: string): Promise<void> {
        const playerIndex: number = this.players.findIndex((a: Player) => a.username == username);

        if (playerIndex < 0) {
            return;
        }

        const gameName = this.players[playerIndex].gameName;

        // Checks if player's game key is correct and player exists
        if (this.playerKeys[gameName] == key) {
            // Removes player
            this.players.splice(playerIndex, 1)
            this.playerList.splice(this.playerList.indexOf(gameName), 1)
            delete this.playerKeys[gameName]

            // Removes 20 points if user leaves mid-game
            if (this.game.started) {
                await this.hooks.addToScore(username, -20)
            }
        }

        if (this.players.length == 0) {
            this.endGame()
        }
    }

    /** Triggers the end of the game. */
    private async endGame(): Promise<void> {
        const { game, players } = this;

        if (this.timers.play) {
            clearTimeout(this.timers.play)
        }

        // Setup next game
        this.resetGame();

        // Sort players by score, needed to award points
        players.sort((a: Player, b: Player) => b.score - a.score);

        // For every player, update their score, and add one to the winning player's win tally
        const updates: Promise<void>[] = [];
        for (let i = 0; i < players.length; i++) {
            this.resetPlayer(players[i]);

            // Solo games don't award points (the formula divides by zero with one player)
            const points = players.length > 1 ? Math.round(20 - (40 * i) / (players.length - 1)) : 0;
            updates.push(this.hooks.addToScore(players[i].username, points, i == 0 ? 1 : 0))
        }

        // If there is a player left, they won the game
        if (players.length > 0) {
            game.lastWinner = players[0].gameName;
        }

        this.hooks.onChange()

        await Promise.all(updates).catch(console.error);
        await this.setRankings()
        this.hooks.onChange()
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
        game.round = 0;
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
    }

    /** Removes a player that is waiting in the lobby, e.g. because they closed the page. */
    removeLobbyPlayer(username: string): void {
        if (this.game.started) return;
        const player = this.players.find((a) => a.username == username);
        if (player) this.removePlayer(username, this.playerKeys[player.gameName]);
    }

    /** Used to set the rankings after a game. Only updates the rankings when needed, as this uses alot of DB reading. */
    async setRankings(): Promise<void> {
        this.rankings = await this.hooks.getRankings();
    }
}
