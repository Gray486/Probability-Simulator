import { Player } from "../../types"

export type PlayerInformation = {
    name: string,
    spectator: boolean
}

export type KnownInformation = {
    nextSpin: number,
    started: boolean,
    round: number,
    canJoin: boolean | null,
    alive: boolean
}

export type SettingsPanels = "#chatDiv" | "#rankingsDiv" | "#friendsDiv" | "#settingsDiv" | "#requestsDiv" | "#dmDiv"