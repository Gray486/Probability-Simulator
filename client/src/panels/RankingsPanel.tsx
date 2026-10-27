import { Ranking } from "../../../types";

function RankingList({ id, title, rankings, value }: { id: string; title: string; rankings: Ranking[]; value: (r: Ranking) => number }) {
    const sorted = rankings.filter((r) => value(r) !== 0).sort((a, b) => value(b) - value(a));
    return (
        <div id={id}>
            <span className="rankingTitle">{title}</span>
            {sorted.map((r) => (
                <div className="ranking" key={r.name}>
                    <span className="name">{r.name}</span>
                    <span className="score">{value(r)}</span>
                </div>
            ))}
        </div>
    );
}

export function RankingsPanel({ rankings }: { rankings: Ranking[] }) {
    return (
        <>
            <RankingList id="byWins" title="Wins" rankings={rankings} value={(r) => r.wins} />
            <RankingList id="byScore" title="Score" rankings={rankings} value={(r) => r.score} />
        </>
    );
}
