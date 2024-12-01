import * as webpush from "web-push";

const { VAPID, G_CLIENT_ID, JWT_SECRET } = KEYS_FILE;
// Link to keys file: https://docs.google.com/document/d/1cb7GLQKhSMh6cB11qgARVA7eCfubcvpuZVbKT0ABnkw/edit?usp=sharing

webpush.setVapidDetails(...VAPID);

async function sendPushNotificaiton(title, body) {
        let subscribers = JSON.parse(fs.readFileSync(__dirname + "/storage/subscribers.json").toString())
        for (let i = 0; i < subscribers.length; i++) {
                const subscription = subscribers[i];
                const payload = {
                        title: title,
                        body: body,
                        icon: "",
                };

                try {
                        await webpush.sendNotification(subscription, JSON.stringify(payload));
                } catch (err) { }
        }

}

let rankings = new Array;

setRankings()
function setRankings() {
        let accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE_PATH).toString());
        rankings = [];
        for (let i = 0; i < accounts.length; i++) {
                let player = accounts[i]
                rankings.push({
                        name: player.username,
                        score: player.score,
                        wins: player.wins
                })
        }
}

app.post('/subscribe', (req, res) => {
        try {
                let subscribers = JSON.parse(fs.readFileSync(__dirname + "/subscribers.json").toString());
                const subscription = req.body;

                subscribers.push(subscription);

                fs.writeFileSync(__dirname + "/subscribers.json", JSON.stringify(subscribers));

                res.status(201).send("Subscription Saved")
        } catch (error) {
                console.error(error)
        }
})

let playerList = new Array;
let players = new Array;
let playerKeys = new Object;
let chat = new Array;
let game = {
        numbersLeft: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        thisSpin: -1,
        lastSpin: -1,
        started: false,
        spinNumber: 0,
        points: 0,
        higher: false,
        round: 1,
        canJoin: true,
        lastWinner: ""
}
let timers;

timers = {
        start: null,
        play: null
}

function generateNumber() {
        canGo = false;
        sendData = true;
        game.lastSpin = game.thisSpin

        if (timers.play) {
                clearTimeout(timers.play);
        }

        let choices = game.numbersLeft;

        if (choices.length == 1) {
                game.points += choices[0]
                for (let i = 0; i < players.length; i++) {
                        if (players[i].alive) {
                                players[i].score += game.points
                                players[i].freeSpin = true;
                        }
                }
                newRound()
                return;
        }

        let spinIndex = Math.floor(Math.random() * (choices.length - 1)) + 1

        game.thisSpin = choices[spinIndex]
        game.spinNumber++

        game.points += game.thisSpin;
        game.numbersLeft.splice(spinIndex, 1)

        game.higher = game.thisSpin > game.lastSpin;

        for (let i = 0; i < players.length; i++) {

                if (players[i].alive) {
                        if (players[i].move == "higher" && !game.higher) {
                                players[i].alive = false
                        } else if (players[i].move == "lower" && game.higher) {
                                players[i].alive = false
                        }

                        players[i].lastMove = players[i].move
                } else if (players[i].move == "bank" || players[i].lastMove == "bank") {
                        players[i].lastMove = "bank"
                } else {
                        players[i].lastMove = "stillOut"
                }

                players[i].move = "none";
        }

        if (!players.filter(a => a.alive).length) {
                setTimeout(function () {
                        newRound()
                }, 8000)
        } else {
                setTimeout(function () {
                        canGo = true;
                        sendData = false;
                }, 2000)
        }

        timers.play = setTimeout(function () {

                if (players.length == 0) {
                        return;
                }

                for (let i = 0; i < players.length; i++) {
                        if (players[i].move == "none" && players[i].alive) {
                                players[i].score += game.points
                                players[i].strikes++
                                players[i].alive = false;
                                players[i].move = "bank";
                        }

                        if (players[i].strikes >= 3) {
                                removePlayer(players[i].name, playerKeys[players[i].name])
                        }
                }

                if (players.length == 0) {
                        return;
                }

                if (players.filter(a => a.alive).length == 0) {
                        newRound()
                        return;
                }

                generateNumber()
        }, 29000)
}

function changeAccountData(change) {
        let accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE_PATH).toString());
        let updated = change(accounts)
        fs.writeFileSync(ACCOUNTS_FILE_PATH, JSON.stringify(updated))
}

function removePlayer(player, key) {

        let playerIndex = players.findIndex(a => a.name == player);

        if (playerIndex > -1 && playerKeys[player] == key) {

                // if (game.started) {
                //         changeAccountData((data) => {
                //                 data[players[playerIndex].username].score -= 50;
                //                 return data;
                //         })
                // }

                players.splice(playerIndex, 1)
                playerList.splice(playerList.indexOf(player), 1)
        }

        if (players.length == 0) {
                endGame()
        }
}

function newRound() {
        if (timers.play) {
                clearTimeout(timers.play)
        }

        if (players.filter(a => a.score >= 100).length > 0) {
                endGame()
                return;
        }

        if (players.length == 0) {
                endGame()
                return;
        }

        console.log("New Round!")

        sendData = true;

        game.points = 0;
        game.numbersLeft = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        game.thisSpin = -1;
        game.lastSpin = -1;
        game.higher = false;

        for (let i = 0; i < players.length; i++) {
                players[i].alive = true;
                players[i].move = "none"
                players[i].lastMove = "none";
        }

        game.round++

        setTimeout(function () {
                generateNumber()
        }, 5000)
}

function endGame() {

        if (timers.play) {
                clearTimeout(timers.play)
        }

        console.log("Game Over!")

        if (timers.play) {
                clearTimeout(timers.play)
        }

        sendData = true;
        game.canJoin = true;

        game.points = 0;
        game.numbersLeft = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        game.thisSpin = -1;
        game.lastSpin = -1;
        game.round = 0;
        game.spinNumber = 0;
        game.started = false;
        game.higher = false;

        players.sort((a, b) => b.score - a.score);

        for (let i = 0; i < players.length; i++) {
                players[i].alive = true;
                players[i].move = "none";
                players[i].lastMove = "none";
                players[i].freeSpin = true;
                players[i].score = 0;
                players[i].ready = false;
                players[i].strikes = 0;

                changeAccountData((data) => {
                        if (i == 0) {
                                data[players[i].username].wins++;
                        }
                        let score = data[players[i].username].score;
                        let newScore = score + Math.round(getScore(i, players.length));
                        data[players[i].username].score = newScore;
                        return data;
                })
        }

        if (players.length > 0) {
                game.lastWinner = players[0];
        }

        setRankings()
}

function getScore(x, y) {
        y--;
        if (x / y < 0.5) {
                x = y - x
                return x / y * 50;
        } else {
                return x / y * -50;
        }
}
