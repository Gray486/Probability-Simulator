import * as bodyParser from "body-parser";
const cookieParser = require("cookie-parser");
import express, { Request, Response } from 'express';
import { authenticate, readMessages, handleFriend, handleUser, inviteFriend, messageFriend, AuthenticatedRequest } from "./accounts";
import { GameData, JoinGameRes, PostObject, SendData, UserLoginRes } from "../types";
import { chat, game, joinGame, makeMove, playerKeys, playerList, players, rankings, removePlayer, sendData, sendMessage, voteStartGame } from "./game";
import { version } from "../index";
import { directMessageChannels } from "./files";
import UserModel from "./database/UserModel";
import { SubscriptionInformation } from "./database/SubscriptionModel";

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())
app.use(express.json())
app.use(express.text())

// Used for logging in users
app.post('/', async (req: Request, res: Response) => {
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
app.get('/get', authenticate, (req: AuthenticatedRequest, res: Response) => {
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

        if (req.user == undefined) {
                res.sendStatus(401);
                return;
        }

        const filteredDirectMessageChannels = directMessageChannels.filter((channel) => channel.initiatedBy == req.user?.username || channel.receiver == req.user?.username)

        allowedData.live = sendData;
        allowedData.chat = chat
        allowedData.version = version;
        allowedData.me = {
                name: req.user.realName,
                username: req.user.username,
                friends: req.user.friends.map((f) => f.username),
                friendRequests: req.user.friendRequests.map((r) => r.username),
                blockedUsers: req.user.blocked.map((b) => b.username),
                directMessageChannels: filteredDirectMessageChannels,
                acceptingFriendRequests: req.user.acceptingFriendRequests,
                silent: req.user.silent
        }

        res.send(allowedData)

})

const clients = new Set<WebSocket>();

app.post('/post', authenticate, async (req: AuthenticatedRequest, res: Response) => {
        let body: PostObject = req.body;
        let user: UserModel | undefined = req.user;
        let key: string | undefined = req.key;

        if (!user) {
                res.sendStatus(401)
                return;
        }

        // Joining game
        if (body.action == "join" && body.name) {
                const joinGameRes: JoinGameRes = joinGame(body.name, user, game.canJoin)

                if (joinGameRes.status == "error") {
                        res.send({ res: joinGameRes })
                } else {
                        res.cookie("key", joinGameRes.key, { httpOnly: true })
                        res.send({ res: "OK" })
                }

                return;
        }

        // Chatting for players not in the game
        if (body.action == "chat" && body.message) {
                sendMessage(body.message, user)
                res.send({ res: "OK" });
                return;
        }

        if (body.action == "handleFriend" && body.username && (body.accept == false || body.accept == true)) {
                const friend = await UserModel.getUser(body.username);
                if (!friend) {
                        res.send({ res: "incorrectDataSent" })
                        return;
                }
                handleFriend(user, friend, body.accept).then((response) => {
                        res.send({ res: response })
                })
                return;
        }

        if (body.action == "silentToggle" && (body.mode == false || body.mode == true)) {
                user.update({ silent: body.mode })
                res.send({ res: "OK" });
                return;
        }

        if (body.action == "acceptRequestsToggle" && (body.mode == false || body.mode == true)) {
                user.update({ acceptingFriendRequests: body.mode })
                res.send({ res: "OK" });
                return;
        }

        if (body.action == "unblock" && body.username) {
                const friend = await UserModel.getUser(body.username);
                if (friend) user.unblock(friend);
                res.send({ res: "OK" });
                return;
        }

        if (body.action == "addFriend" && body.username) {
                const friend = await UserModel.getUser(body.username);
                if (friend) user.request(friend);
                res.send({ res: "OK" });
                return;
        }

        if (body.action == "messageFriend" && body.username && body.message) {
                const friend = await UserModel.getUser(body.username);
                messageFriend(user, friend, body.message).then((response) => {
                        res.send({ res: response })
                })
                return;
        }

        if (body.action == "readMessages" && body.friend && body.messageReverseIndices) {
                readMessages(user, body.friend, body.messageReverseIndices)
                res.send({ res: "OK" });
                return;
        }

        if (body.action == "inviteFriend" && body.username) {
                const friend = await UserModel.getUser(body.username);
                if (friend) {
                        res.send({ res: inviteFriend(user, friend) })
                }
                return;
        }

        // From here on out only players with their correct game key can do actions
        // NOTE: Game keys can likely be removed due to new JWT implementation

        // Chatting for players in the game
        if (body.action == "chatInGame" && body.message && body.name && key && playerKeys[body.name] == key) {
                sendMessage(body.message, user, body.name);
                res.send({ res: "OK" });
                return;
        }

        // Starting the game
        if (body.action == "start" && body.name && key && playerKeys[body.name] == key) {
                voteStartGame(user.username);
                res.send({ res: "OK" });
                return;
        }

        // Making a move
        if (body.action == "play" && body.move && body.name && key && playerKeys[body.name] == key) {
                makeMove(body.move, body.name)
                res.send({ res: "OK" });
                return;
        }

        res.send({ res: "incorrectDataSent" })
})

// Used to leave the game. Browser sends beacon here on page close.
app.post('/leave', (req: AuthenticatedRequest, res: Response) => {
        if (req.key && req.user) {
                removePlayer(req.user.username, req.key)
        }
        res.send("OK")
})

// Route used to subscribe to push notifications.
app.post('/subscribe', authenticate, (req: AuthenticatedRequest, res: Response) => {
        let subscription: SubscriptionInformation = req.body;
        if (req.user) {
                req.user.addSubscription(subscription);
                res.status(201).send("Subscribed")
        } else {
                res.sendStatus(401)
        }
})

// Protected static routes

openStaticRoute("game", true, "client.html")
openStaticRoute("js/client.js", true)
openStaticRoute("worker.js", true, "js/worker.js")

// Unprotected static routes

openStaticRoute("audio.m4a", false)
openStaticRoute("logo.png", false)
openStaticRoute("client.css", false)
openStaticRoute("", false, "home.html")

app.get('/status', (req: Request, res: Response) => {
        res.send("All systems go!")
})

// Catch-all 404 page
app.get("*", (req: Request, res: Response) => {
        res.status(404).sendFile("404.html", { 'root': __dirname + "/../client/static" })
})

/**
 * Opens a static route at the "/../client/static/" directory.
 * @param route Route to open. Omit starting "/".
 * @param protectedRoute Whether to protect the route. Defaults to `true`.
 * @param file The relative file path for the route.
 */
function openStaticRoute(route: string): void
function openStaticRoute(route: string, protectedRoute: boolean): void
function openStaticRoute(route: string, protectedRoute: boolean, file: string): void
function openStaticRoute(route: string, protectedRoute: boolean = true, file?: string) {
        if (protectedRoute) {
                app.get('/' + route, (req: Request, res: Response) => {
                        authenticate(req, res, () => {
                                res.sendFile(file ? file : route, { 'root': __dirname + "/../client/static" })
                        })
                })
        } else {
                app.get('/' + route, (req: Request, res: Response) => {
                        res.sendFile(file ? file : route, { 'root': __dirname + "/../client/static" })
                })
        }
}

/** Opens server on specified port. */
export function openWebServer(port: number) {
        app.listen(port, () => {
                console.log(`Listening on ${port}!`)
        })
}
