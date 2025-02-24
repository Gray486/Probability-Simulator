import { KnownInformation, PlayerInformation } from "types";

/** Information that is currently known about the game. */
export let known: KnownInformation = {
    nextSpin: 1,
    started: false,
    round: 1,
    canJoin: null,
    alive: false
};

/** The name and spectator status of the player. */
export let me: PlayerInformation = {
    name: "",
    spectator: false,
    joinedGame: false
};