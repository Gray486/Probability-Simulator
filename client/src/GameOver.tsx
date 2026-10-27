import { useEffect } from "react";
import { Game } from "../../types";

/**
 * Final standings of the game that just ended.
 * @param ranked Whether the game changed rank points, private lobby games don't.
 */
export function GameOver({ game, username, ranked, onClose }: { game: Game; username: string; ranked: boolean; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key == "Escape") onClose() };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const results = game.lastResults;
    const mine = results.find((r) => r.username == username);

    return (
        <div id="gameOver" onClick={onClose}>
            <div className="card" onClick={(e) => e.stopPropagation()}>
                <h1><i className="bi bi-trophy-fill"></i> {game.lastWinner ? `${game.lastWinner} wins!` : "Game Over!"}</h1>
                <p className="summary">
                    {game.lastRounds} {game.lastRounds == 1 ? "round" : "rounds"}
                    {mine && ` · You placed ${results.indexOf(mine) + 1} of ${results.length}`}
                    {!ranked && " · Unranked"}
                </p>
                <table>
                    <thead>
                        <tr><th>#</th><th>Player</th><th>Score</th><th>Busts</th>{ranked && <th>Rank pts</th>}</tr>
                    </thead>
                    <tbody>
                        {results.map((r, i) => (
                            <tr key={r.username} className={r.username == username ? "me" : ""}>
                                <td>{i + 1}</td>
                                <td title={r.username}>{r.gameName}</td>
                                <td>{r.score}</td>
                                <td>{r.busts}</td>
                                {ranked && <td className={r.points > 0 ? "gain" : r.points < 0 ? "loss" : ""}>{r.points > 0 ? `+${r.points}` : r.points}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
}
