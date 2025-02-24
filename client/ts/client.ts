import { ItemProps } from "spin-wheel";
import { Player, PostObject, SendData } from "../../types";
import { known, me } from "state";

let data: SendData;

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

        if (JSON.stringify($("#chatText").html().split("\n")) != JSON.stringify(data.chat)) {
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