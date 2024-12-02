import * as bodyParser from "body-parser";
const cookieParser = require("cookie-parser");
const express = require("express");
import { authenticate, handleUser } from "./accounts";
import { GameData, JoinGameRes, SendData, UserLoginRes } from "./types";
import { chat, game, joinGame, makeMove, playerKeys, playerList, players, rankings, removePlayer, sendData, sendMessage, voteStartGame } from "./game";
import { addToSubscriberDB } from "./files";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(express.json())
app.use(express.text())

// Used for logging in users
app.post('/', async (req: any, res: any) => {
    const loginRes: UserLoginRes = await handleUser(req.cookies.g_csrf_token, req.body.g_csrf_token, req.body.credential);

    if (loginRes.success) {
        res.cookie("token", loginRes.token, { httpOnly: true })
        res.redirect("./game")
    } else {
        res.status(loginRes.status).send(loginRes.message)
    }
})

/** Data that is allowed to be viewed by clients at this time. */
let allowedData: SendData;

// Data for client to retrieve about game
app.get('/get', (req: any, res: any) => {
    authenticate(req, res, () => {
        let data: GameData = {
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

app.post('/post', (req: any, res: any) => {
    authenticate(req, res, (user, key) => {
        let body = req.body;
        let action = body.action;

        // Joining game
        if (action == "join") {
            const joinGameRes: JoinGameRes = joinGame(body.name, user, game.canJoin)

            if (joinGameRes.status == "error") {
                res.send({ res: joinGameRes})
            } else {
                res.cookie("key", joinGameRes.key, { httpOnly: true })
                res.send({ res: "OK" })
            }

            return;
        }

        // Chatting for players not in the game
        if (action == "chat" && !body.name) {
            sendMessage(body.msg, user.realName, user.realName)
            res.send({ res: "OK" });
            return;
        }

        // From here on out only players with their correct game key can do actions
        if (!body.name || playerKeys[body.name] != key) {
            res.sendStatus(400);
            return;
        }

        // Chatting for players in the game
        if (action == "chat") {
            sendMessage(body.msg, body.name, user.realName);
            res.send({ res: "OK" });
            return;
        }

        // Starting the game
        if (action == "start") {
            voteStartGame(user.username);
            res.send({ res: "OK" });
            return;
        }

        // Making a move
        if (action == "play") {
            makeMove(body.move, body.name)
            res.send({ res: "OK" });
            return;
        }

        res.status(400).send({ res: "Command not found" })

    })
})

// Used to leave the game. Browser sends beacon here on page close.
app.post('/leave', (req: any, res: any) => {
    authenticate(req, res, (user, key) => {
        if (key) {
            removePlayer(user.username, key)
        }
        res.send("OK")
    })
})

// Route used to subscribe to push notifications.
app.post('/subscribe', (req: any, res: any) => {
    addToSubscriberDB(req.body);
    res.status(201).send("Subscribed")
})

// Protected static routes

app.get('/game', (req: any, res: any) => {
    authenticate(req, res, () => {
        res.sendFile("client.html", {'root': __dirname + "/../static"})
    })
})

app.get('/client.js', (req: any, res: any) => {
    authenticate(req, res, () => {
        res.sendFile("client.js", {'root': __dirname + "/../static"})
    })
})

app.get('/worker.js', (req: any, res: any) => {
    authenticate(req, res, () => {
        res.sendFile("worker.js", {'root': __dirname + "/../static"})
    })
})

// Unprotected static routes

app.get('/audio.m4a', (req: any, res: any) => {
    res.sendFile("audio.m4a", {'root': __dirname + "/../static"})
})

app.get('/', (req: any, res: any) => {
    res.sendFile("home.html", {'root': __dirname + "/../static"})
})

app.get('/status', (req: any, res: any) => {
    res.send("All systems go!", {'root': __dirname + "/../static"})
})

// Catch-all 404 page
app.get("*", (req: any, res: any) => {
    res.status(404).sendFile("404.html", {'root': __dirname + "/../static"})
})

/** Opens server on specified port */
export function openWebServer(port: number) {
    app.listen(port, () => {
        console.log(`Listening on ${port}!`)
    })
}