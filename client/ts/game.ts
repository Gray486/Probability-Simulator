import { ItemProps } from "spin-wheel";
import { me } from "state";
import { overlays, wheel } from "wheel";
import { Move, Player } from "../../types";

/** The countdown timer for making a move. */
let playTimer: number = 0;
/** The interval between increments of the {@link playTimer}. */
let playTimerInterval: NodeJS.Timeout;

function newRound(generatedNumber: number) {
    if (playTimerInterval) {
        clearInterval(playTimerInterval)
        $("#timer").hide()
    }

    if (!wheel) return;

    const index: number = wheel.items.findIndex((a: ItemProps) => a.label == generatedNumber.toString())

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
        wheel.overlayImage = overlays[generatedNumber]

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

export function joinGame(name: string) {
    post({
        action: "join",
        name: name
    }).then(function (res) {
        console.log(res)

        if (res == "OK" && name) {
            state.me.name = name
            $("#controls").show()
            $("#controls button").prop("disabled", true)
        } else {
            $("#joinDiv").show()
            $("#wheel").hide()
            alert("ERROR: " + res.msg)
        }

        me.joinedGame = true;
    })
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