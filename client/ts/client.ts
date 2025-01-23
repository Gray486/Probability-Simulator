import { ItemProps, Wheel, WheelProps } from "spin-wheel";
import { DirectMessageChannel, Message, Move, Player, PostObject, Ranking, SendData } from "../../types";
import { KnownInformation, PlayerInformation, SettingsPanels } from "./types";

let data: SendData;

/** Information that is currently known about the game. */
let known: KnownInformation = {
        nextSpin: 1,
        started: false,
        round: 1,
        canJoin: null,
        alive: false
};

/** The name and spectator status of the player. */
let me: PlayerInformation = {
        name: "",
        spectator: false,
        joinedGame: false
};

if (window.location.host == "dev.grayjn.com") {
        $(document).ready(function () {
                $("#dev").show()
        })
}

let dmInterval: NodeJS.Timeout;

async function post(data: PostObject) {
        console.log(data)

        const url = "/post"
        return fetch(url, {
                method: "POST",
                credentials: 'same-origin',
                headers: {
                        'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
        }).then(res => res.json()).then(data => {
                return data.res
        });
}

async function get(): Promise<SendData | undefined> {
        try {
                return fetch("/get").then((res) => res.json().then((res) => {
                        return res;
                }));
        } catch (err) {
                console.error(err)
        }
}

const props: WheelProps = {
        items: [
                {
                        label: '1',
                },
                {
                        label: '8',
                },
                {
                        label: '5',
                },
                {
                        label: '12',
                },
                {
                        label: '7',
                },
                {
                        label: '2',
                },
                {
                        label: '13',
                },
                {
                        label: '4',
                },
                {
                        label: '11',
                },
                {
                        label: '6',
                },
                {
                        label: '9',
                },
                {
                        label: '3'
                },
                {
                        label: '10'
                }

        ]
}

let overlays: HTMLImageElement[] = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image()]
overlays[0].src = "https://i.ibb.co/HVWxZgh/Overlay.png";
overlays[1].src = "https://i.ibb.co/RPcCrgk/Overlay-1.png";
overlays[2].src = "https://i.ibb.co/ggCKYxT/Overlay-2.png";
overlays[3].src = "https://i.ibb.co/vLRczqN/Overlay-3.png";
overlays[4].src = "https://i.ibb.co/VLPWFjg/Overlay-4.png";
overlays[5].src = "https://i.ibb.co/FBvSRLD/Overlay-5.png";
overlays[6].src = "https://i.ibb.co/YbCT0g1/Overlay-6.png";
overlays[7].src = "https://i.ibb.co/RY0Q2PH/Overlay-7.png";
overlays[8].src = "https://i.ibb.co/J2w3Q4m/Overlay-8.png";
overlays[9].src = "https://i.ibb.co/RBFqyTr/Overlay-9.png";
overlays[10].src = "https://i.ibb.co/7pGR2Jf/Overlay-10.png";
overlays[11].src = "https://i.ibb.co/XLgxKgr/Overlay-11.png";
overlays[12].src = "https://i.ibb.co/Vt6x01r/Overlay-12.png";
overlays[13].src = "https://i.ibb.co/BV2DvGf/Overlay-13.png";

const container: Element | null = document.querySelector('#wheel');

let wheel: Wheel | null;
makeWheel()

function makeWheel() {
        //@ts-ignore
        wheel = new spinWheel.Wheel(container, props);

        if (!wheel) return;

        for (let i: number = 0; i < 12; i++) {
                wheel.itemBackgroundColors[i] = "#863dd9"
        }

        wheel.overlayImage = overlays[0];
        wheel.borderWidth = 5;
        wheel.lineWidth = 5;
        wheel.itemLabelFontSizeMax = 60;
        wheel.isInteractive = false;
        wheel.itemLabelAlign = 'center';
        wheel.itemLabelRotation = 90;
        wheel.itemLabelBaselineOffset = -0.2;
}

let playTimer: number = 0;
let playTimerInterval: NodeJS.Timeout;

function numberChosen(number: number) {
        if (playTimerInterval) {
                clearInterval(playTimerInterval)
                $("#timer").hide()
        }

        if (!wheel) return;

        let index: number = wheel.items.findIndex((a: ItemProps) => a.label == number.toString())

        if (index == -1) {
                console.error("Number not found on wheel")
                return;
        }

        wheel.spinToItem(index, 7000, false, 2, 1, (x: number) => -Math.pow(Math.min(1, Math.max(0, -x + 1)), 3) + 1)

        setTimeout(function () {
                if (!wheel) return;

                wheel.items.splice(index, 1)
                wheel.items[0].labelColor = "black"

                wheel.items.forEach((item: ItemProps) => {
                        if (item.label) {
                                if (parseInt(item.label) > number) {
                                        item.backgroundColor = "#d9d93d"
                                } else {
                                        item.backgroundColor = "#863dd9"
                                }
                        }
                })

                $("#pot").text(data.game.points)
                wheel.overlayImage = overlays[number]
 
                if (data.players.find((a: Player) => a.gameName == me.name)?.alive) {
                        $("#controls button").prop("disabled", false)
                }

                for (let i: number = 0; i < data.players.length; i++) {
                        if (!data.players[i].alive && data.players[i].lastMove != "bank") {
                                $(`#player-${data.players[i].gameName} #play`).html(`<i class="bi bi-x-square-fill" style="color: red;"></i>`)
                        }
                }


                $("#timer").show()
                $("#timer").text("20")
                playTimer = 0;
                playTimerInterval = setInterval(function () {
                        playTimer++;
                        $("#timer").text(20 - playTimer)
                        if (playTimer > 20 && playTimerInterval) {
                                $("#timer").hide()
                                clearInterval(playTimerInterval)
                        }
                }, 1000)
        }, 7000)
}

let images: HTMLImageElement[] = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image()]
images[0].src = "https://i.ibb.co/7CjQrHJ/Lights-8.png";
images[1].src = "https://i.ibb.co/G2Xts03/Lights-7.png";
images[2].src = "https://i.ibb.co/RHzMpks/Lights-6.png";
images[3].src = "https://i.ibb.co/qYyf7hN/Lights-5.png";
images[4].src = "https://i.ibb.co/0yJ8hFJ/Lights-4.png";
images[5].src = "https://i.ibb.co/X87CF26/Lights-3.png";
images[6].src = "https://i.ibb.co/gFy4s26/Lights-2.png";
images[7].src = "https://i.ibb.co/LYh5CN7/Lights-1.png";
images[8].src = "https://i.ibb.co/Qbjdyx9/Lights.png";

let currentImage: number = 0;

setInterval(function () {
        if (!wheel) return;
        wheel.image = images[currentImage]
        currentImage++
        if (currentImage == images.length) {
                currentImage = 0
        }
}, 1000)

$("#join").on('click', function () {
        $("#joinDiv").hide()
        $("#wheel").show()

        let name: string | undefined = $("#name").val()?.toString();

        if (!name) {
                name = data.me.name;
        }

        post({
                action: "join",
                name: name
        }).then(function (res) {
                console.log(res)

                if (res == "OK" && name) {
                        me.name = name
                        $("#controls").show()
                        $("#controls button").prop("disabled", true)
                } else {
                        $("#joinDiv").show()
                        $("#wheel").hide()
                        alert("ERROR: " + res.msg)
                }

                me.joinedGame = true;
        })
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

function play(move: Move) {
        $("#controls button").prop("disabled", true)
        post({
                action: "play",
                move: move,
                name: me.name
        }).then(function (res) {
                if (res !== "OK") {
                        alert(res)
                        console.warn(res)
                        $("#controls button").prop("disabled", false)
                }

                if (res == "OK" && move == "freeSpin") {
                        $("#freeSpin").hide()
                }
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

let starttime: number;
let starttimer: NodeJS.Timeout;

reloadData(true)
function reloadData(firstTime: boolean = false) {
        setTimeout(async function () {
                let lastData: SendData | undefined = data;
                const getData: SendData | undefined = await get()
                if (!getData) return;
                data = getData;

                if (firstTime || JSON.stringify(lastData.players) != JSON.stringify(data.players)) {
                        console.log("Updating player data")
                        $("#players").html("")

                        if (data.game.canJoin != known.canJoin) {
                                known.canJoin = data.game.canJoin;
                                if (!data.game.canJoin && $("#joinDiv").css("display") != "none") {
                                        me.spectator = true;
                                        $("#joinDiv").hide()
                                        $("#wheel").show()
                                        $("#spectator").show()

                                        known.nextSpin = data.game.spinNumber++

                                        let spunNumbers: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter(a => !data.game.numbersLeft.includes(a))

                                        setTimeout(function () {
                                                if (!wheel) return;

                                                for (let i: number = 0; i < spunNumbers.length; i++) {
                                                        let index: number = wheel.items.findIndex((a: ItemProps) => a.label == spunNumbers[i].toString())
                                                        wheel.items.splice(index, 1)
                                                }

                                                wheel.items[0].labelColor = "black"
                                        }, 250)

                                }

                                if (me.spectator && data.game.canJoin) {
                                        window.location.reload()
                                }
                        }

                        let playersData: Player[] = data.players;
                        playersData.sort((a, b) => b.score - a.score)

                        for (let i: number = 0; i < playersData.length; i++) {
                                let player: string = playersData[i].gameName
                                let playerData: Player = playersData[i]
                                $("#players").append(`
                                        <div class="player" id="player-${player}">
                                                <i class="bi bi-ticket-detailed-fill ticket-indicator" style="display: ${playerData.freeSpin ? "block" : "none"};"></i>
                                                <h2 title="${playerData.username}">${player}</h2>
                                                <span id="points">${playerData.score}</span>
                                                <span id="play">${moveStyler[playerData.lastMove]}</span>
                                                <span style="color: #0e1131;">.</span>
                                        </div>
                                `)
                        }

                        let myData: Player | undefined = data.players.find((a) => a.gameName == me.name)

                        if (myData?.alive && myData.alive !== known.alive) {
                                known.alive = myData.alive;
                                if (!myData.alive) {
                                        console.log("busted!")
                                        $("#newRound").text("You busted!!")
                                        $("#newRound").fadeIn(500);
                                        setTimeout(() => {
                                                $("#newRound").fadeOut(500);
                                        }, 1500)
                                }
                        }

                        if (!data.game.started) {
                                let readyPlayers: number = data.players.filter(a => a.ready).length
                                if (readyPlayers > 0 && readyPlayers !== lastData?.players?.filter(a => a.ready)?.length) {
                                        if (starttimer) {
                                                clearInterval(starttimer)
                                        }


                                        starttime = 14
                                        $("#timer").show()
                                        $("#timer").text("15")

                                        starttimer = setInterval(function () {
                                                if (starttime <= 0) {
                                                        clearInterval(starttimer)
                                                        starttime = 14
                                                        $("#timer").hide()
                                                        return;
                                                }
                                                $("#timer").text(starttime)
                                                starttime -= 1;
                                        }, 1000)
                                }
                        }

                }

                if (lastData?.chat && data.chat && JSON.stringify(lastData.chat) !== JSON.stringify(data.chat)) {
                        $("#chatText").html(data.chat.join("\n"))
                }

                $("#startCount").text(`${data.players.filter((a) => a.ready).length} / ${data.playerList?.length || 0}`)

                if (known.started !== data.game.started && data.game.started) {
                        known.started = true;
                        $("#timer").hide()
                        clearInterval(starttimer)
                        $("#start").hide()
                }

                if (known.started !== data.game.started && !data.game.started) {
                        known.started = false;
                        $("#start").show()
                }

                if (known.round !== data.game.round) {
                        if (data?.players?.find(a => a.gameName == me.name)?.freeSpin) {
                                $("#freeSpin").show()
                        }

                        if (data.game.round == 0 && $("#joinDiv").css("display") == "none" && !me.spectator) {
                                setTimeout(() => {
                                        if (data.game.lastWinner) {
                                                $("#newRound").text(`${data.game.lastWinner} has won the game!`)
                                        } else {
                                                $("#newRound").text("Game Over!")
                                        }
                                        makeRankings()
                                }, 750)
                                known.nextSpin = 1;
                                known.started = false;
                                clearInterval(playTimerInterval)
                                $("#newRound").fadeIn(500)
                                setTimeout(function () {
                                        $("#newRound").fadeOut(500)
                                }, 3000)
                                $("#start-btn").prop("disabled", false)
                        } else if (data.game.started && me.name) {
                                $("#newRound").text("New Round Starting!")
                                clearInterval(playTimerInterval)
                                $("#timer").hide()
                                $("#newRound").fadeIn(500)
                                setTimeout(function () {
                                        $("#newRound").fadeOut(500)
                                }, 3000)
                        }

                        known.round = data.game.round;
                        
                        if (wheel) {
                                wheel.remove()
                                wheel = null;
                        };

                        makeWheel()
                }

                if (data.game.started && known.nextSpin == data.game.spinNumber) {
                        numberChosen(data.game.thisSpin)
                        known.nextSpin++
                }

                if (firstTime) {
                        $("#versionNumber").text("Version: " + data.version)
                        $("#joinDiv #name").attr("placeholder", data.me.username);
                        $("#settingsUsername").text(data.me.username)
                        $("#allPushToggle").prop("checked", data.me.silent)
                        $("#acceptRequestsBox").prop("checked", data.me.acceptingFriendRequests)
                }

                reloadData()
        }, 250)
}

async function makeRankings() {
        const getData: SendData | undefined = await get()
        if (!getData) return;

        const rankings: Ranking[] = getData.rankings;

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

// Set to true for dev mode
if (false) {
        $("#joinDiv").hide()
} else {
        $("#wheel").hide()
        $("#controls").hide()
}

var backgroundMusic: HTMLAudioElement = new Audio('/audio.m4a');
backgroundMusic.addEventListener('ended', function () {
        this.currentTime = 0;
        this.play();
}, false);

backgroundMusic.volume = 0.1;

$("html").on('click', function () {
        backgroundMusic.play()
})

$("#newRound").hide()
$("#timer").hide()
$("#spectator").hide()
$("#rankingsDiv").hide()

$(window).on("unload", function () {
        navigator.sendBeacon("/leave");
})

const publicVapidKey = "BEORef-fuEOyljiEmeRuLSf17uqmGGKNN0Y4kNF3XbGYr6KfukGSbCj5AkSGsBpT8vUB6GV0cLoZsv9g3MG_XSg";

async function subscribeToPush() {
        const workers: readonly ServiceWorkerRegistration[] = await navigator.serviceWorker.getRegistrations()

        let register: ServiceWorkerRegistration;

        if (workers.length > 0) {
                console.log("Service worker already registered.")
                register = workers[0]
        } else {
                console.log("Registering service worker...");
                register = await navigator.serviceWorker.register("/worker.js", {
                        scope: "/"
                });
        }

        if (!(await register.pushManager.getSubscription())) {
                console.log("Registering Push...");
                const subscription: PushSubscription = await register.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });

                console.log("Subscribing for Push ...");
                await fetch("/subscribe", {
                        method: "POST",
                        body: JSON.stringify(subscription),
                        headers: {
                                "Content-Type": "application/json"
                        }
                });
        } else {
                console.log("Push already registerd.");
        }

}

function urlBase64ToUint8Array(base64String: string) {
        const padding: string = "=".repeat((4 - base64String.length % 4) % 4);
        const base64: string = (base64String + padding)
                .replace(/\-/g, "+")
                .replace(/_/g, "/");

        const rawData: string = window.atob(base64);
        const outputArray: Uint8Array = new Uint8Array(rawData.length);

        for (let i: number = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
}

if ('serviceWorker' in navigator) {
        subscribeToPush();
}

// Friend menu buttons

function createEventsFriendMenuButtons() {
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

                openDmFriendPanel(friend)

                dmInterval = setInterval(() => {
                        const friend: string | undefined = $(this).parent().parent().data("username")
                        if (!friend) return;
                        openDmFriendPanel(friend, true)
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

function openFriendsPanel() {
        $("#friendsDiv").html(`					
                <button class="friendButton" id="addFriend">Add friend</button>
                <button class="friendButton" id="viewRequests">View requests</button>
        `)

        for (let i: number = 0; i < data.me.friends.length; i++) {
                const dmChannel: DirectMessageChannel | undefined = data.me.directMessageChannels.find((a) => a.initiatedBy == data.me.friends[i] || a.receiver == data.me.friends[i])
                const numberOfUnread: number | undefined = dmChannel?.messages.filter((m) => m.from == data.me.friends[i] || !m.read).length

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

        createEventsFriendMenuButtons()
}

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

function openDmFriendPanel(friend: string, reload: boolean = false) {
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

        post({action: "unblock", username: user}).then((res) => {
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