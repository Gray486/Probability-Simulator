let data = {};
let known = {
        players: [],
        nextSpin: 1,
        started: false,
        round: 1,
        canJoin: null,
        winner: "",
        alive: false
};
let me = {
        name: "",
        spectator: false
};

if (window.location.host == "dev.grayjn.com") {
        $(document).ready(function () {
                $("#dev").show()
        })
}

function makeUser(name, password, realName) {
        console.log(`"${name}": {"username": "${name}", "password": "${password}", "name": "${realName}", "score": 0, "wins": 0}`)
}

async function post(data) {
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

async function get() {
        try {
                return fetch("/get").then((res) => res.json().then((res) => {
                        return res;
                }));
        } catch (err) {
                console.error(err)
        }
}

const props = {
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

let overlays = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image()]
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

const container = document.querySelector('#wheel');

let wheel;
makeWheel()

function makeWheel() {
        wheel = new spinWheel.Wheel(container, props);

        for (i = 0; i < 12; i++) {
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

let playTimer = 0;
let playTimerInterval = null;

function numberChosen(number) {
        if (playTimerInterval) {
                clearInterval(playTimerInterval)
                $("#timer").hide()
        }

        let index = wheel.items.findIndex((a) => a.label == number)

        if (index == -1) {
                console.error("Number not found on wheel")
                return;
        }

        wheel.spinToItem(index, 7000, false, 2, 1, (x) => -Math.pow(Math.min(1, Math.max(0, -x + 1)), 3) + 1)

        setTimeout(function () {
                wheel.items.splice([index], 1)
                wheel.items[0].labelColor = "black"

                wheel.items.forEach((item) => {
                        if (item.label > number) {
                                item.backgroundColor = "#d9d93d"
                        } else {
                                item.backgroundColor = "#863dd9"
                        }
                })

                $("#pot").text(data.game.points)
                wheel.overlayImage = overlays[number]

                if (data.players.find(a => a.gameName == me.name).alive) {
                        $("#controls button").prop("disabled", false)
                }

                for (i = 0; i < data.players.length; i++) {
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
                        if (playTimer > 20) {
                                $("#timer").hide()
                                clearInterval(playTimerInterval)
                        }
                }, 1000)
        }, 7000)
}

let images = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image(), new Image()]
images[0].src = "https://i.ibb.co/7CjQrHJ/Lights-8.png";
images[1].src = "https://i.ibb.co/G2Xts03/Lights-7.png";
images[2].src = "https://i.ibb.co/RHzMpks/Lights-6.png";
images[3].src = "https://i.ibb.co/qYyf7hN/Lights-5.png";
images[4].src = "https://i.ibb.co/0yJ8hFJ/Lights-4.png";
images[5].src = "https://i.ibb.co/X87CF26/Lights-3.png";
images[6].src = "https://i.ibb.co/gFy4s26/Lights-2.png";
images[7].src = "https://i.ibb.co/LYh5CN7/Lights-1.png";
images[8].src = "https://i.ibb.co/Qbjdyx9/Lights.png";

let currentImage = 0

setInterval(function () {
        wheel.image = images[currentImage]
        currentImage++
        if (currentImage == images.length) {
                currentImage = 0
        }
}, 1000)

$("#join").click(function () {
        $("#joinDiv").hide()
        $("#wheel").show()

        post({
                action: "join",
                name: $("#name").val()
        }).then(function (res) {
                console.log(res)

                if (res == "OK") {
                        me.name = $("#name").val()
                        $("#controls").show()
                        $("#controls button").prop("disabled", true)
                } else {
                        $("#joinDiv").show()
                        $("#wheel").hide()
                        alert("ERROR: " + res.msg)
                }
        })
})

$("#msgText").on("keyup", function (e) {
        e.preventDefault()
        if (e.which == 13) {
                $("#msg").click()
        }
})

$("#msg").click(function () {
        if (me.spectator) {
                post({ action: "chat", msg: $("#msgText").val() })
        } else {
                post({ name: me.name, action: "chat", msg: $("#msgText").val() })
        }
        $("#msgText").val("")
})

$("#name").on("keyup", function (e) {
        e.preventDefault()
        if (e.which == 13) {
                $("#join").click()
        }
})

$("#start-btn").click(function () {
        post({
                action: "start",
                name: me.name
        }).then(function (res) {
                if (res == "OK") {
                        $("#start-btn").prop("disabled", true);
                }
        })
})

$("#bank").click(function () {
        play("bank")
})

$("#higher").click(function () {
        play("higher")
})

$("#lower").click(function () {
        play("lower")
})

$("#freeSpin").click(function () {
        play("freeSpin")
})

$("#chatSwitch").click(function () {
        openPanel("#chatDiv")
})

$("#rankingsSwitch").click(function () {
        openPanel("#rankingsDiv")
})

$("#settingsSwitch").click(function () {
        openPanel("#settingsDiv")
})

$("#friendsSwitch").click(function () {
        openPanel("#friendsDiv")
})

function openPanel(id) {
        let divs = ["#chatDiv", "#rankingsDiv", "#friendsDiv", "#settingsDiv"]

        for (let i = 0; i < divs.length; i++) {
                if (divs[i] !== id) $(divs[i]).fadeOut(100)
        }

        $(id).fadeIn(100)
}

function play(move) {
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

let starttime;
let starttimer;

reloadData()
function reloadData() {
        setTimeout(async function () {
                let lastData = data
                data = await get()

                if (JSON.stringify(lastData.players) != JSON.stringify(data.players)) {
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

                                        let spunNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].filter(a => !data.game.numbersLeft.includes(a))

                                        setTimeout(function () {
                                                for (i = 0; i < spunNumbers.length; i++) {
                                                        let index = wheel.items.findIndex((a) => a.label == spunNumbers[i])
                                                        wheel.items.splice(index, 1)
                                                }

                                                wheel.items[0].labelColor = "black"
                                        }, 250)

                                }

                                if (me.spectator && data.game.canJoin) {
                                        window.location.reload()
                                }
                        }

                        let playersData = data.players;
                        playersData.sort((a, b) => b.score - a.score)

                        for (i = 0; i < playersData.length; i++) {
                                let player = playersData[i].gameName
                                let playerData = playersData[i]
                                $("#players").append(`
                                        <div class="player" id="player-${player}">
                                                <i class="bi bi-ticket-detailed-fill ticket-indicator" style="display: ${playerData.freeSpin ? "block" : "none"};"></i>
                                                <h2 title="${playerData.realName}">${player}</h2>
                                                <span id="points">${playerData.score}</span>
                                                <span id="play">${moveStyler[playerData.lastMove]}</span>
                                                <span style="color: #0e1131;">.</span>
                                        </div>
                                `)
                        }

                        let myData = data.players.find((a) => a.gameName == me.name)

                        console.log(myData?.alive)

                        if (myData?.alive && myData.alive !== known.alive) {
                                known.alive = myData.alive;
                                console.log(known.alive)
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
                                let readyPlayers = data.players.filter(a => a.ready).length
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

                if (JSON.stringify(lastData.chat) !== JSON.stringify(data.chat)) {
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
                                }, 750)
                                known.nextSpin = 1;
                                known.started = 0;
                                clearInterval(playTimerInterval)
                                $("#newRound").fadeIn(500)
                                setTimeout(function () {
                                        $("#newRound").fadeOut(500)
                                        makeRankings()
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

                        if (data.players.length > 0) {
                                known.winner = data.players.sort((a, b) => b.score - a.score)[0]
                        }

                        known.round = data.game.round;
                        wheel.remove()
                        wheel = null;
                        makeWheel()
                }

                if (data.game.started && known.nextSpin == data.game.spinNumber) {
                        numberChosen(data.game.thisSpin)
                        known.nextSpin++
                }

                reloadData()
        }, 250)
}

async function makeRankings() {
        let players = (await get()).rankings;

        players = players.filter((a) => a.score !== 0)

        let byWins = [...players.sort((a, b) => b.wins - a.wins)]
        let byScore = [...players.sort((a, b) => b.score - a.score)]

        $("#byScore").html(`<span class="rankingTitle">Score</span>`)
        $("#byWins").html(`<span class="rankingTitle">Wins</span>`)

        console.log(byWins)

        for (let i = 0; i < players.length; i++) {
                $("#byScore").append(`
                        <div class="ranking">
                                <span id="name">${byScore[i].name}</span>
                                <span id="score">${byScore[i].score}</span>
                        </div>
                `)

                $("#byWins").append(`
                        <div class="ranking">
                                <span id="name">${byWins[i].name}</span>
                                <span id="score">${byWins[i].wins}</span>
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

var backgroundMusic = new Audio('/audio.m4a');
backgroundMusic.addEventListener('ended', function () {
        this.currentTime = 0;
        this.play();
}, false);

backgroundMusic.volume = 0.1;

$("html").click(function () {
        backgroundMusic.play()
})

$("#newRound").hide()
$("#timer").hide()
$("#spectator").hide()
$("#rankingsDiv").hide()

$(window).on("unload", function () {
        navigator.sendBeacon("/leave");
})

const publicVapidKey = "BFfnB1YSRe73kuMCVXJLJ0uKCtEJNvmhIMxi5YR-VP9stTURSQMxRy3-LA2AkgnFB0Yoq50Qo2-Aj-D_c1K9n2A";

async function subscribeToPush() {

        const workers = await navigator.serviceWorker.getRegistrations()

        let register;

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
                const subscription = await register.pushManager.subscribe({
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

function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
                .replace(/\-/g, "+")
                .replace(/_/g, "/");

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
}

if ('serviceWorker' in navigator) {
        subscribeToPush();
}
