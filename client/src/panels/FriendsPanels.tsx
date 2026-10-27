import { SendData } from "../../../types";
import { post } from "../api";

type Me = SendData["me"];

/** Number of unread messages from a friend. */
export function unreadFrom(me: Me, friend: string): number {
    const channel = me.directMessageChannels.find((c) => c.initiatedBy == friend || c.receiver == friend);
    return channel?.messages.filter((m) => m.from == friend && !m.read).length ?? 0;
}

export function FriendsPanel({ me, onOpenDm, onViewRequests }: { me: Me; onOpenDm: (friend: string) => void; onViewRequests: () => void }) {
    async function addFriend() {
        const friendName = prompt("Please enter the username of the user you would like to friend.");
        if (!friendName) return;

        const res = await post({ action: "addFriend", username: friendName });
        alert(res !== "OK" ? `ERROR: ${res}` : "Friend request sent!");
    }

    return (
        <>
            <button className="friendButton" onClick={addFriend}>Add friend</button>
            <button className="friendButton" onClick={onViewRequests}>
                View requests{me.friendRequests.length > 0 && ` (${me.friendRequests.length})`}
            </button>
            {me.friends.map((friend) => (
                <div className="friend" key={friend}>
                    <span className="name">{friend}</span>
                    <div className="options">
                        {unreadFrom(me, friend) > 0 && <div className="notifications"></div>}
                        <i className="bi bi-chat-left-dots-fill friend-button" title="Open DM" onClick={() => onOpenDm(friend)}></i>{" "}
                        <i className="bi bi-trash-fill friend-button" title="Remove"
                            onClick={() => post({ action: "handleFriend", username: friend, accept: false })}></i>{" "}
                        <i className="bi bi-send-plus-fill friend-button" title="Invite to play"
                            onClick={() => post({ action: "inviteFriend", username: friend })}></i>
                    </div>
                </div>
            ))}
        </>
    );
}

export function RequestsPanel({ me }: { me: Me }) {
    return (
        <>
            <h1>Friend Requests</h1>
            <h3>Denying requests will block users. Unblock in settings.</h3>
            {me.friendRequests.map((friend) => (
                <div className="friend-request" key={friend}>
                    <span className="name">{friend}</span>
                    <div className="options">
                        <i className="bi bi-x-lg deny-friend-request friend-button" title="Deny"
                            onClick={() => post({ action: "handleFriend", username: friend, accept: false })}></i>{" "}
                        <i className="bi bi-check-lg friend-button" title="Accept"
                            onClick={() => post({ action: "handleFriend", username: friend, accept: true })}></i>
                    </div>
                </div>
            ))}
        </>
    );
}
