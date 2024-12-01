import * as express from "express";
import * as bodyParser from "body-parser";
import * as cookieParser from "cookie-parser";
import { authenticate, handleUser } from "./accounts";
import { UserLoginRes } from "./types";
import { chat, game, joinGame, makeMove, playerKeys, playerList, players, sendMessage } from "./game";

const app = express();

let port: number = 8000;

// You can specify port on project run
// EX: node index.js port 9999
if (process.argv.indexOf("port") > -1) {
    port = parseInt(process.argv[process.argv.indexOf("port") + 1])
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(express.json())
app.use(express.text())

// Used for logging in users
app.post('/', async (req, res) => {
    const loginRes: UserLoginRes = await handleUser(req.cookies.g_csrf_token, req.body.g_csrf_token, req.body.credential);

    if (loginRes.success) {
        res.cookie("token", loginRes.token, { httpOnly: true })
        res.redirect("./game")
    } else {
        res.status(loginRes.status).send(loginRes.message)
    }

})

let allowedData;
let sendData: boolean = true;

// Data for client to retrieve about game
app.get('/get', (req, res) => {
    authenticate(req, res, () => {
        let data = {
            playerList: playerList,
            players: players,
            game: game,
            rankings: rankings
        }

        if (sendData && JSON.stringify(allowedData) !== JSON.stringify(data)) {
            // Probably bad practice but used to copy object
            allowedData = JSON.parse(JSON.stringify(data));
        }

        allowedData.live = sendData;
        allowedData.chat = chat

        res.send(allowedData)
    })
})

let canGo = true;

app.post('/post', (req, res) => {

    authenticate(req, res, (user, key) => {

        let body = req.body;
        let action = body.action;

        // Joining game
        if (action == "join") {
            const joinGameRes = joinGame(body.name, user, game.canJoin)

            if (joinGameRes.status == "error") {
                res.send(joinGameRes)
            } else {
                res.cookie("key", joinGameRes.key, { httpOnly: true })
                res.send({ res: "OK" })
            }

            return;
        }

        // Chatting for players not in the game
        if (action == "chat" && !body.name) {
            sendMessage(body.msg, user.name, user.name)
            res.send({ res: "OK" });
            return;
        }

        // From here on out only players with their correct key can do actions
        if (!body.name || playerKeys[body.name] != key) {
            res.sendStatus(400);
            return;
        }

        // Chatting for players in the game
        if (action == "chat") {
            sendMessage(body.msg, body.name, user.name)
            res.send({ res: "OK" });
            return;
        }

        // Starting the game
        if (action == "start") {
            res.send({ res: "OK" });
            return;
        }

        // Making a move
        if (action == "play") {
            makeMove(body.move, body.name)
        }

        res.status(400).send({ res: "Command not found" })

    })
})

// Used to leave the game. Browser sends beacon here on page close.
// TODO: Verify that this works under new key system
app.post('/leave', (req, res) => {
    authenticate(req, res, (user, key) => {
        removePlayer(user.username, key)
        res.send("OK")
    })
})

// Protected static routes

app.get('/game', (req, res) => {
    authenticate(req, res, () => {
        res.sendFile(__dirname + "/static/client.html")
    })
})

app.get('/client.js', (req, res) => {
    authenticate(req, res, () => {
        res.sendFile(__dirname + "/static/client.js")
    })
})

app.get('/worker.js', (req, res) => {
    authenticate(req, res, () => {
        res.sendFile(__dirname + "/static/worker.js")
    })
})

// Unprotected static routes

app.get('/audio.m4a', (req, res) => {
    res.sendFile(__dirname + "/static/audio.m4a")
})

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/static/home.html")
})

app.get('/status', (req, res) => {
    res.send("All systems go!")
})

// Catch-all 404 page
app.get("*", (req, res) => {
    res.status(404).sendFile(__dirname + "/static/404.html")
})

// Opens server on port
app.listen(port, () => {
    console.log(`Listening on ${port}!`)
})