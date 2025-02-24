import { DirectMessageChannel } from "../../types";

function markDmsRead(friend: string) {
    const channel: DirectMessageChannel | undefined = data.me.directMessageChannels.find((a: DirectMessageChannel) => {
        return a.receiver == friend || a.initiatedBy == friend
    })

    if (!channel) {
        return;
    };

    const allMessages = channel.messages;

    let unreadMessageReverseIndices: number[] = [];
    for (let i: number = 0; i < allMessages.length; i++) {
        if (!allMessages[i].read && allMessages[i].from == friend) {
            unreadMessageReverseIndices.push(allMessages.length - i)
        }
    }

    if (unreadMessageReverseIndices.length > 0) {
        post({ action: "readMessages", friend: friend, messageReverseIndices: unreadMessageReverseIndices })
    }
}