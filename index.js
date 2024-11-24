const express = require('express');
const app = express();
const webpush = require('web-push');
const fs = require('fs');
let port = 8000;

if (process.argv.indexOf("port") > -1) {
        port = process.argv[process.argv.indexOf("port") + 1]
}

const ACCOUNTS_FILE = __dirname + "/accounts.json";
const VAPID = JSON.parse(fs.readFileSync(__dirname + "/keys.json").toString()).VAPID

webpush.setVapidDetails(...VAPID);

app.use(express.json())
app.use(express.text())

function auth(req, res, next) {
        let users = JSON.parse(fs.readFileSync(ACCOUNTS_FILE).toString());
        let auth;

        if (req.headers.authorization) {
                auth = Buffer.from(req.headers.authorization.substring(6), 'base64').toString().split(':');
        }

        if (!auth || !users[auth[0]] || auth[1] !== users[auth[0]].password) {
                res.statusCode = 401;
                res.setHeader('WWW-Authenticate', 'Basic realm="Gray"');
                res.sendFile(__dirname + "/static/401.html");
        } else {
                next(users[auth[0]]);
        }
}

app.get('/', (req, res) => {
        res.sendFile(__dirname + "/static/home.html")
})

app.get('/status', (req, res) => {
        res.send("All systems go!")
})

app.get('/game', (req, res) => {
        auth(req, res, () => {
                res.sendFile(__dirname + "/static/client.html")
        })
})

app.get('/client.js', (req, res) => {
        auth(req, res, () => {
                res.sendFile(__dirname + "/static/client.js")
        })
})

app.get('/worker.js', (req, res) => {
        auth(req, res, () => {
                res.sendFile(__dirname + "/static/worker.js")
        })
})

async function sendPushNotificaiton(title, body) {
        let subscribers = JSON.parse(fs.readFileSync(__dirname + "/subscribers.json"))
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

let allowedData = {};
let sendData = true;
let canGo = true;
let rankings = [];

setRankings()
function setRankings() {
        let accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE));
        rankings = [];
        for (let i = 0; i < Object.keys(accounts).length; i++) {
                let player = accounts[Object.keys(accounts)[i]]
                rankings.push({
                        name: player.name,
                        score: player.score,
                        wins: player.wins
                })
        }
}

app.get('/get', (req, res) => {
        auth(req, res, () => {
                let data = {
                        playerList: playerList,
                        players: players,
                        game: game,
                        rankings: rankings
                }

                if (sendData && JSON.stringify(allowedData) !== JSON.stringify(data)) {
                        allowedData = JSON.parse(JSON.stringify(data));
                }

                allowedData.live = sendData;
                allowedData.chat = chat

                res.send(allowedData)
        })
})

app.get('/audio.m4a', (req, res) => {
        res.sendFile(__dirname + "/static/audio.m4a")
})

app.post('/leave', (req, res) => {
        let data = JSON.parse(req.body)

        if (data.name && data.key) {
                removePlayer(data.name, data.key)
        }

        res.send("OK")
})

app.post('/post', (req, res) => {

        auth(req, res, (user) => {

                let body = req.body;
                let action = body.action;

                if (action == "join" && game.canJoin) {
                        if (body.name && !playerList.includes(body.name) && players.findIndex(a => a.username == user.username) < 0) {
                                playerList.push(body.name)
                                players.push({
                                        name: body.name,
                                        realName: user.name,
                                        username: user.username,
                                        score: 0,
                                        ready: false,
                                        freeSpin: true,
                                        alive: true,
                                        move: "none",
                                        lastMove: "",
                                        strikes: 0
                                })
                                let newKey = Math.round(Math.random() * 100000000000)
                                playerKeys[body.name] = newKey
                                res.send({ res: newKey })
                                return;
                        } else {
                                res.send({ res: "error" })
                                return;
                        }
                }

                if (action == "chat" && !body.name) {
                        sendMsg(body.msg, user.name, user.name)
                }

                if (!body.name || playerKeys[body.name] != body.key) { return }

                if (action == "chat") {
                        sendMsg(body.msg, body.name, user.name)
                }

                if (action == "start") {
                        players.find((a) => a.name == body.name).ready = true;

                        let numberOfReady = players.filter((a) => a.ready == true).length;

                        if (numberOfReady == 1) {
                                sendPushNotificaiton("Game about to start!", `${user.name} just voted to start a game!`)
                        }

                        if (numberOfReady == playerList.length && numberOfReady > 1 && !game.started) {
                                game.started = true;
                                game.canJoin = false;
                                generateNumber()
                        }

                        if (timers.start) {
                                clearTimeout(timers.start)
                        }

                        timers.start = setTimeout(function () {
                                if (!game.started && players.filter((a) => a.ready == true).length > 1) {
                                        game.started = true;
                                        game.canJoin = false;
                                        generateNumber()
                                }
                        }, 18000)

                        res.send({ res: "OK" });
                        return;
                }

                if (action == "play") {
                        let player = players.findIndex(a => a.name == body.name)

                        switch (body.move) {
                                case "bank":
                                        players[player].score += game.points
                                        players[player].alive = false;
                                        players[player].move = "bank";
                                        break;
                                case "freeSpin":
                                        if (players[player].freeSpin == true) {
                                                players[player].freeSpin = false;
                                                players[player].move = "freeSpin";
                                        } else {
                                                players[player].move = "none";
                                        }
                                        break;
                                case "higher":
                                        players[player].move = "higher";
                                        break;
                                case "lower":
                                        players[player].move = "lower";
                                        break;
                                default:
                                        players[player].move = "none";
                                        break;
                        }

                        if (!game.started || !canGo) {
                                players[player].move = "none"
                        }

                        if (players[player].move == "none") {
                                res.send({ res: "Move not registered! Please do not cheat!" })
                                return;
                        }

                        players[player].strikes = 0;

                        let alivePlayers = players.filter(a => a.alive)

                        if (players.filter(a => a.alive && a.move !== "none").length == alivePlayers.length && alivePlayers.length) {
                                generateNumber()
                        }

                        if (alivePlayers.length == 0) {
                                newRound()
                        }

                        res.send({ res: "OK" })
                        return;
                }

                res.send({ res: "Command not found" })

        })
})

app.post('/subscribe', async (req, res) => {
        try {
                let subscribers = JSON.parse(fs.readFileSync(__dirname + "/subscribers.json"));
                const subscription = req.body;

                subscribers.push(subscription);

                fs.writeFileSync(__dirname + "/subscribers.json", JSON.stringify(subscribers));

                res.status(201).send("Subscription Saved")
        } catch (error) {
                console.error(error)
        }
})

app.listen(port, () => {
        console.log(`Listening on ${port}!`)
})

let playerList = []
let players = []
let playerKeys = []
let chat = []
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
let timers = {
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
                for (i = 0; i < players.length; i++) {
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

        for (i = 0; i < players.length; i++) {

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
        console.log("DATA HAS BEEN CHANGED")
        let accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE));
        let updated = change(accounts)
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(updated))
}

function sendMsg(msg, user, realName) {
        if (chat.length > 50) {
                chat.splice(0, 1)
        }

        if (!user) {
                user = "???"
        }

        chat.push(`${user}: ${msg}`)

        fs.appendFileSync(__dirname + "/chatlog.txt", `${realName}: ${msg}\n`)
}

function removePlayer(player, key) {

        let playerIndex = players.findIndex(a => a.name == player);

        if (playerIndex > -1 && playerKeys[player] == key) {

                if (game.started && false) {
                        changeAccountData((data) => {
                                data[players[playerIndex].username].score -= 50;
                                return data;
                        })
                }

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

        for (i = 0; i < players.length; i++) {
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

        for (i = 0; i < players.length; i++) {
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
