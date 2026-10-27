import { SendData } from "../../types";
import { post } from "./api";

/** Scores the host can pick for a private lobby to be played to. */
const POINTS_TO_WIN = [25, 50, 100, 150, 200, 300];

function openLobby(code: string) {
    location.href = `/game?lobby=${encodeURIComponent(code)}`;
}

/** Creating, joining and leaving private lobbies, plus the host's settings. */
export function LobbyBar({ data }: { data: SendData }) {
    const { lobby, game } = data;

    async function create() {
        const res = await post({ action: "createLobby" });
        if (res?.code) openLobby(res.code);
        else alert(res);
    }

    function join() {
        const code = prompt("Enter the lobby code.")?.trim();
        if (code) openLobby(code.toUpperCase());
    }

    if (!lobby) {
        return (
            <div id="lobbyBar">
                <button onClick={create}>Create private lobby</button>
                <button onClick={join}>Join lobby</button>
            </div>
        );
    }

    const isHost = lobby.host == data.me.username;
    const link = `${location.origin}/game?lobby=${lobby.code}`;

    return (
        <div id="lobbyBar">
            <span>Private lobby <b>{lobby.code}</b></span>
            <button title={link} onClick={() => navigator.clipboard.writeText(link).then(() => alert("Lobby link copied!"))}>
                <i className="bi bi-link-45deg"></i> Copy link
            </button>
            {isHost && !game.started ? (
                <label>
                    Play to{" "}
                    <select value={game.pointsToWin} onChange={(e) => post({ action: "lobbySettings", pointsToWin: Number(e.target.value) })}>
                        {[...new Set([...POINTS_TO_WIN, game.pointsToWin])].sort((a, b) => a - b).map((points) => (
                            <option key={points} value={points}>{points}</option>
                        ))}
                    </select>
                </label>
            ) : (
                <span>Playing to <b>{game.pointsToWin}</b></span>
            )}
            <button onClick={() => { location.href = "/game" }}>Leave</button>
        </div>
    );
}
