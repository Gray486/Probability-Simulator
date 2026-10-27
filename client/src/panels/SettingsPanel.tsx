import { SendData } from "../../../types";
import { post } from "../api";

/** A labelled checkbox on its own row. */
function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
    return (
        <label className="setting" htmlFor={id}>
            <span>
                {label}
                <small>{hint}</small>
            </span>
            <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        </label>
    );
}

export function SettingsPanel({ me, version, musicOn, onMusicToggle }: { me: SendData["me"]; version: string; musicOn: boolean; onMusicToggle: (on: boolean) => void }) {
    async function unblockUser(user: string) {
        const res = await post({ action: "unblock", username: user });
        if (res !== "OK") alert(res);
    }

    return (
        <>
            <h1>{me.username}</h1>
            <div id="stats">
                <div><b>{me.stats.gamesPlayed}</b><span>Games</span></div>
                <div><b>{me.stats.wins}</b><span>Wins</span></div>
                <div><b>{me.stats.gamesPlayed ? Math.round(100 * me.stats.wins / me.stats.gamesPlayed) : 0}%</b><span>Win rate</span></div>
                <div><b>{me.stats.bestGame}</b><span>Best game</span></div>
                <div><b>{me.stats.busts}</b><span>Busts</span></div>
                <div><b>{me.stats.score}</b><span>Rank pts</span></div>
            </div>
            <div className="settingsGroup">
                <Toggle id="allPushToggle" label="Do not disturb" hint="No push notifications" checked={me.silent}
                    onChange={(on) => post({ action: "silentToggle", mode: on })} />
                <Toggle id="acceptRequestsBox" label="Friend requests" hint="Let people send you requests" checked={me.acceptingFriendRequests}
                    onChange={(on) => post({ action: "acceptRequestsToggle", mode: on })} />
                <Toggle id="toggleMusic" label="Music" hint="Background track" checked={musicOn} onChange={onMusicToggle} />
            </div>
            {me.blockedUsers.length > 0 && (
                <div className="settingsGroup" id="blockedSettings">
                    <h3>Blocked users</h3>
                    {me.blockedUsers.map((user) => (
                        <div className="blockedUser" key={user}>
                            <span>{user}</span>
                            <button onClick={() => unblockUser(user)}>Unblock</button>
                        </div>
                    ))}
                </div>
            )}
            <div id="credits">
                <span>Version {version}</span><br />
                <span>Consultant: Esan Ebner</span><br />
                <span>Music: Willustrious Ellen</span><br />
                <span>Developer: Gray Jackson-Noell</span><br />
                <span><a style={{ color: "#123cad" }} href="https://docs.google.com/forms/d/e/1FAIpQLSc7buVVu51Fy1M8N1935f2DNMRVgVZGXi3dhwlE-mUV89rqzQ/viewform?usp=preview" target="_blank">Suggestion / Bug Report Form</a></span>
            </div>
        </>
    );
}
