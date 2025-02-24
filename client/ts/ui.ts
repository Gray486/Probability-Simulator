import { joinGame } from "game";
import { SettingsPanels } from "types";
import { DirectMessageChannel, Message, Ranking, SendData } from "../../types";
import { me } from "state";

if (window.location.host !== "game.grayjn.com") {
    $(document).ready(function () {
        $("#dev").show()
    })
}

const moveStyler = {
    "": "",
    none: "",
    higher: `<i class="bi bi-arrow-up-square-fill" style="color: #d9d93d;"></i>`,
    lower: `<i class="bi bi-arrow-down-square-fill" style="color: #863dd9;"></i>`,
    bank: `<i class="bi bi-bank2" style="color: #4266c9;"></i>`,
    freeSpin: `<i class="bi bi-ticket-detailed-fill" style="color: #1bc640;"></i>`,
    stillOut: `<i class="bi bi-x-square-fill" style="color: red;"></i>`
}

$("#join").on('click', function () {
    $("#joinDiv").hide()
    $("#wheel").show()

    let name: string | undefined = $("#name").val()?.toString();

    if (!name) {
        name = data.me.name;
    }

    joinGame(name);
})

$("#msgText").on("keyup", function (e) {
    e.preventDefault()
    if (e.which == 13) {
        $("#msg").click()
    }
})

$("#msg").on('click', function () {
    let message: string | undefined = $("#msgText").val()?.toString();

    if (!message) return;

    if (me.spectator || !me.joinedGame) {
        post({ action: "chat", message: message })
    } else {
        post({ name: me.name, action: "chatInGame", message: message })
    }
    $("#msgText").val("")
})

$("#name").on("keyup", function (e) {
    e.preventDefault()
    if (e.which == 13) {
        $("#join").click()
    }
})

$("#start-btn").on('click', function () {
    post({
        action: "start",
        name: me.name
    }).then(function (res) {
        if (res == "OK") {
            $("#start-btn").prop("disabled", true);
        }
    })
})

$("#bank").on('click', function () {
    play("bank")
})

$("#higher").on('click', function () {
    play("higher")
})

$("#lower").on('click', function () {
    play("lower")
})

$("#freeSpin").on('click', function () {
    play("freeSpin")
})

$("#chatSwitch").on('click', function () {
    openPanel("#chatDiv")
})

$("#rankingsSwitch").on('click', function () {
    openPanel("#rankingsDiv")
})

$("#settingsSwitch").on('click', function () {
    openPanel("#settingsDiv")
})

$("#friendsSwitch").on('click', function () {
    openFriendsPanel()
})

$("#dmMsg").on('click', function () {
    const message: string | undefined = $("#dmMsgText").val()?.toString();
    if (!message) return;

    post({
        action: "messageFriend", username: $(this).data("username"), message: message,
    })

    $("#dmMsgText").val("")
})

$("#dmMsgText").on("keyup", function (e) {
    e.preventDefault()
    if (e.which == 13) {
        $("#dmMsg").click()
    }
})

let dmInterval: NodeJS.Timeout;

/** Opens one of the settings panels. */
function openPanel(id: SettingsPanels) {
    if (dmInterval && id != "#dmDiv") { clearInterval(dmInterval) }

    let divs: SettingsPanels[] = ["#chatDiv", "#rankingsDiv", "#friendsDiv", "#settingsDiv", "#requestsDiv", "#dmDiv"]

    for (let i: number = 0; i < divs.length; i++) {
        if (divs[i] !== id) $(divs[i]).fadeOut(100)
    }

    if (data.me.blockedUsers.length > 0) {
        $("#blockedSettings").show()

        let blockedUsers: string = "<br>";

        for (let i: number = 0; i < data.me.blockedUsers.length; i++) {
            blockedUsers += `<span>${data.me.blockedUsers[i]}</span><br>`
        }

        blockedUsers += "<br>"

        $("#blockedUsersList").html(blockedUsers)

    } else {
        $("#blockedSettings").hide()
    }

    $(id).fadeIn(100)
}

async function makeRankings() {
    const rankings: Ranking[] = ;

    let byWins: Ranking[] = [...rankings.sort((a: Ranking, b: Ranking) => b.wins - a.wins)]
    byWins = byWins.filter((a: Ranking) => a.wins !== 0)

    let byScore: Ranking[] = [...rankings.sort((a: Ranking, b: Ranking) => b.score - a.score)]
    byScore = byScore.filter((a: Ranking) => a.score !== 0);

    $("#byWins").html(`<span class="rankingTitle">Wins</span>`)
    $("#byScore").html(`<span class="rankingTitle">Score</span>`)

    for (let i: number = 0; i < byWins.length; i++) {
        $("#byWins").append(`
                        <div class="ranking">
                                <span id="name">${byWins[i].name}</span>
                                <span id="score">${byWins[i].wins}</span>
                        </div>
                `)
    }

    for (let i: number = 0; i < byScore.length; i++) {
        $("#byScore").append(`
                        <div class="ranking">
                                <span id="name">${byScore[i].name}</span>
                                <span id="score">${byScore[i].score}</span>
                        </div>
                `)
    }
}
makeRankings()

/** The background music object. */
const backgroundMusic: HTMLAudioElement = new Audio('/audio.m4a');

backgroundMusic.addEventListener('ended', function () {
    this.currentTime = 0;
    this.play();
}, false);

backgroundMusic.volume = 0.1;

$("html").on('click', function () {
    backgroundMusic.play()
})

/** Opens the generates the HTML and opens the friends panel. */
function openFriendsPanel() {
    $("#friendsDiv").html(`					
                <button class="friendButton" id="addFriend">Add friend</button>
                <button class="friendButton" id="viewRequests">View requests</button>
        `)

    for (let i: number = 0; i < data.me.friends.length; i++) {
        const dmChannel: DirectMessageChannel | undefined = data.me.directMessageChannels.find((a) => a.initiatedBy == data.me.friends[i] || a.receiver == data.me.friends[i])
        const numberOfUnread: number | undefined = dmChannel?.messages.filter((m) => m.from == data.me.friends[i] && !m.read).length

        $("#friendsDiv").append(`
                        <div class="friend" data-username="${data.me.friends[i]}">
                                <span class="name">${data.me.friends[i]}</span>
                                <div class="options">
                                        ${numberOfUnread && numberOfUnread > 0 ? '<div class="notifications"></div>' : ""}
                                        <i class="bi bi-chat-left-dots-fill dm-friend friend-button" title="Open DM"></i>
                                        <i class="bi bi-trash-fill remove-friend friend-button" title="Remove"></i>
                                        <i class="bi bi-send-plus-fill invite-friend friend-button" title="Invite to play"></i>
                                </div>
                        </div>
                `)
    }

    openPanel("#friendsDiv")

    generateListenersForFriendMenuButtons()
}

function generateListenersForFriendMenuButtons() {
    $("#friendsDiv").removeAttr("inert")

    $("#addFriend").off('click');
    $("#addFriend").on('click', function () {
        const friendName: string | null = prompt("Please enter the username of the user you would like to friend.")
        if (!friendName) return;

        post({ action: "addFriend", username: friendName }).then((res) => {
            if (res !== "OK") {
                alert(`ERROR: ${res}`)
            } else {
                alert("Friend request sent!")
            }
        })
    })

    $(".dm-friend").off('click');
    $(".dm-friend").on('click', function () {
        const friend: string | undefined = $(this).parent().parent().data("username")

        if (!friend) return;

        openDmPanel(friend)

        dmInterval = setInterval(() => {
            const friend: string | undefined = $(this).parent().parent().data("username")
            if (!friend) return;
            openDmPanel(friend, true)
            markDmsRead(friend)
        }, 1000)
    })

    $(".remove-friend").off('click');
    $(".remove-friend").on('click', function () {
        const friend: string | undefined = $(this).parent().parent().data("username")
        if (!friend) return;
        $("#friendsDiv").attr("inert", "")
        post({ action: "handleFriend", username: friend, accept: false }).then((res) => { openFriendsPanel() })
    })

    $(".invite-friend").off('click');
    $(".invite-friend").on('click', function () {
        const friend: string | undefined = $(this).parent().parent().data("username")
        if (!friend) return;
        $("#friendsDiv").attr("inert", "")
        post({ action: "inviteFriend", username: friend }).then((res) => { openFriendsPanel() })
    })

    $("#viewRequests").off('click');
    $("#viewRequests").on('click', function () {
        $("#requestsDiv").html(`					
                        <h1>Friend Requests</h1>
                        <h3>Dening requests will block users. Unblock in settings.</h3>
                `)

        for (let i: number = 0; i < data.me.friendRequests.length; i++) {
            $("#requestsDiv").append(`
                                <div class="friend-request" data-username="${data.me.friendRequests[i]}">
                                        <span class="name">${data.me.friendRequests[i]}</span>
                                        <div class="options">
                                                <i class="bi bi-x-lg deny-friend-request" title="Accept"></i>
                                                <i class="bi bi-check-lg accept-friend-request" title="Deny"></i>
                                        </div>
                                </div>
                        `)
        }

        openPanel("#requestsDiv")

        $(".deny-friend-request").off('click');
        $(".deny-friend-request").on('click', function () {
            const friend: string | undefined = $(this).parent().parent().data("username")
            if (!friend) return;
            post({ action: "handleFriend", username: friend, accept: false }).then((res) => {
                setTimeout(() => {
                    openFriendsPanel()
                }, 750)
            })
        })

        $(".accept-friend-request").off('click');
        $(".accept-friend-request").on('click', function () {
            const friend: string | undefined = $(this).parent().parent().data("username")
            if (!friend) return;
            post({ action: "handleFriend", username: friend, accept: true }).then((res) => {
                setTimeout(() => {
                    openFriendsPanel()
                }, 750)
            })
        })
    })
}

function openDmPanel(friend: string, reload: boolean = false) {
    const messages: Message[] | undefined = data.me.directMessageChannels.find((a) => a.receiver == friend || a.initiatedBy == friend)?.messages;

    $("#dmMsg").data("username", friend)
    let chatText: string = ""

    if (messages) {
        messages.forEach((message) => {
            chatText += `\n${message.from}: ${message.content}`
        })
    }

    $("#dmText").html(chatText)

    if (!reload) {
        openPanel("#dmDiv")
    }
}

setInterval(() => {
    const unreadMessages: boolean = data.me.directMessageChannels.find((dm: DirectMessageChannel) => {
        return dm.messages.find((m) => m.from != data.me.username && !m.read) != undefined;
    }) != undefined;

    if (unreadMessages) {
        $("#friendsNotificationDot").css('color', 'red')
    } else {
        $("#friendsNotificationDot").css('color', 'black')
    }
}, 2000)

$("#allPushToggle").on('click', function () {
    const toggle = this as HTMLInputElement;
    post({ action: "silentToggle", mode: toggle.checked })
})

$("#acceptRequestsBox").on('click', function () {
    const toggle = this as HTMLInputElement;
    post({ action: "acceptRequestsToggle", mode: toggle.checked })
})

$("#toggleMusic").on('click', function () {
    const toggle = this as HTMLInputElement;
    if (!toggle.checked) {
        backgroundMusic.volume = 0;
    } else {
        backgroundMusic.volume = 0.1;
    }
})

$("#unblockUser").on('click', function () {
    const user: string | null = prompt("Please enter the username of the user to unblock.")
    if (!user || !data.me.blockedUsers.includes(user)) {
        alert("User not found.")
        return;
    };

    post({ action: "unblock", username: user }).then((res) => {
        if (res !== "OK") {
            alert(res)
        } else {
            alert("Unblocked user.")
            setTimeout(() => {
                openPanel("#settingsDiv")
            }, 750)
        }
    })
})

$("#newRound").hide()
$("#timer").hide()
$("#spectator").hide()
$("#rankingsDiv").hide()

$(window).on("unload", function () {
    navigator.sendBeacon("/leave");
})