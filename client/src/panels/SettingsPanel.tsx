import { SendData } from "../../../types";
import { post } from "../api";

export function SettingsPanel({ me, version, musicOn, onMusicToggle }: { me: SendData["me"]; version: string; musicOn: boolean; onMusicToggle: (on: boolean) => void }) {
    async function unblockUser() {
        const user = prompt("Please enter the username of the user to unblock.");
        if (!user || !me.blockedUsers.includes(user)) {
            alert("User not found.");
            return;
        }

        const res = await post({ action: "unblock", username: user });
        alert(res !== "OK" ? res : "Unblocked user.");
    }

    return (
        <>
            <h1>{me.username}</h1>
            <label htmlFor="allPushToggle">Do not disturb:</label>
            <input id="allPushToggle" type="checkbox" checked={me.silent}
                onChange={(e) => post({ action: "silentToggle", mode: e.target.checked })} /><br />
            <label htmlFor="acceptRequestsBox">Accepting requests:</label>
            <input id="acceptRequestsBox" type="checkbox" checked={me.acceptingFriendRequests}
                onChange={(e) => post({ action: "acceptRequestsToggle", mode: e.target.checked })} />
            <label htmlFor="toggleMusic">Background track</label>
            <input id="toggleMusic" type="checkbox" checked={musicOn} onChange={(e) => onMusicToggle(e.target.checked)} />
            {me.blockedUsers.length > 0 && (
                <div id="blockedSettings">
                    <h3 id="blockedUsersListHeading">Blocked Users</h3>
                    <div id="blockedUsersList">
                        <br />
                        {me.blockedUsers.map((user) => <div key={user}>{user}</div>)}
                        <br />
                    </div>
                    <button id="unblockUser" onClick={unblockUser}>Click to Unblock Users</button>
                </div>
            )}
            <div id="credits">
                <span>Version: {version}</span><br />
                <span>Consultant: Esan Ebner</span><br />
                <span>Music: Willustrious Ellen</span><br />
                <span>Developer: Gray Jackson-Noell</span><br />
                <span><a style={{ color: "#123cad" }} href="https://docs.google.com/forms/d/e/1FAIpQLSc7buVVu51Fy1M8N1935f2DNMRVgVZGXi3dhwlE-mUV89rqzQ/viewform?usp=preview" target="_blank">Suggestion / Bug Report Form</a></span>
            </div>
        </>
    );
}
