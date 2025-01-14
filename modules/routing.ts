import * as bodyParser from "body-parser";
const cookieParser = require("cookie-parser");
import express, { Request, Response } from 'express';
import { addFriend, authenticate, handleFriend, handleUser, inviteFriend, messageFriend, setFriendRequestMode, setSilentMode, unblockUser } from "./accounts";
import { DirectMessageChannel, GameData, JoinGameRes, SendData, SubscriptionInformation, UserLoginRes } from "./types";
import { chat, game, joinGame, makeMove, playerKeys, playerList, players, rankings, removePlayer, sendData, sendMessage, voteStartGame } from "./game";
import { addToSubscriberDB, getDirectMessageChannels } from "./files";

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
app.get('/get', (req: Request, res: Response) => {
        authenticate(req, res, async (user) => {
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

                let directMessageChannels: DirectMessageChannel[] = await new Promise<DirectMessageChannel[]>((resolve) => {
                        getDirectMessageChannels((directMessageChannels) => {
                                resolve(directMessageChannels);
                        });
                });

                directMessageChannels.filter((channel) => channel.initiatedBy == user.username || channel.receiver == user.username)

                allowedData.live = sendData;
                allowedData.chat = chat
                allowedData.me = {
                        name: user.realName,
                        username: user.username,
                        friends: user.friends,
                        friendRequests: user.friendRequests,
                        blockedUsers: user.blockedUsers,
                        directMessageChannels: directMessageChannels
                }

                res.send(allowedData)

        })
})

app.post('/post', (req: Request, res: Response) => {
        authenticate(req, res, (user, userIndex, key) => {
                let body = req.body;
                let action = body.action;

                // Joining game
                if (action == "join" && body.name) {
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
                if (action == "chat" && !body.name) {
                        sendMessage(body.msg, user.realName, user.realName)
                        res.send({ res: "OK" });
                        return;
                }

                if (action == "handleFriend" && body.username && (body.accept == false || body.accept == true) && userIndex) {
                        console.log(body.username, body.accept)

                        handleFriend(userIndex, body.username, body.accept).then((response) => {
                                console.log(response)
                                res.send({ res: response })
                        })
                        return;
                }

                if (action == "silentToggle" && userIndex && (body.mode == false || body.mode == true)) {
                        setSilentMode(userIndex, body.silent)
                }

                if (action == "acceptRequestToggle" && userIndex && (body.mode == false || body.mode == true)) {
                        setFriendRequestMode(userIndex, body.mode)
                }

                if (action == "unblock" && userIndex && body.user) {
                        unblockUser(userIndex, body.user)
                }

                if (action == "addFriend" && body.username && userIndex) {
                        addFriend(userIndex, body.username).then((response) => {
                                res.send({ res: response })
                        })
                        return;
                }

                if (action == "messageFriend" && body.username && body.message) {
                        messageFriend(user, body.username, body.message).then((response) => {
                                res.send({ res: response })
                        })
                        return;
                }

                if (action == "inviteFriend" && body.username) {
                        res.send({ res: inviteFriend(user, body.username) })
                        return;
                }

                // From here on out only players with their correct game key can do actions
                // NOTE: Game keys can likely be removed due to new JWT implementation
                if (!body.name || playerKeys[body.name] != key) {
                        res.send({ res: "incorrectDataSent" })
                        return;
                }

                // Chatting for players in the game
                if (action == "chat" && body.name && key) {
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
                if (action == "play" && body.move && body.name) {
                        makeMove(body.move, body.name)
                        res.send({ res: "OK" });
                        return;
                }

                res.send({ res: "incorrectDataSent" })

        })
})

// Used to leave the game. Browser sends beacon here on page close.
app.post('/leave', (req: Request, res: Response) => {
        authenticate(req, res, (user, userIndex, key) => {
                if (key) {
                        removePlayer(user.username, key)
                }
                res.send("OK")
        })
})

// Route used to subscribe to push notifications.
app.post('/subscribe', (req: Request, res: Response) => {
        authenticate(req, res, (user) => {
                let subscription: SubscriptionInformation = req.body;
                subscription.username = user.username;
                addToSubscriberDB(subscription);
                res.status(201).send("Subscribed")
        })
})

// Protected static routes

openStaticRoute("game", true, "client.html")
openStaticRoute("client.js", true)
openStaticRoute("worker.js", true)

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
        res.status(404).sendFile("404.html", { 'root': __dirname + "/../served" })
})

/**
 * Opens a static route at the "/../served/" directory.
 * @param route Route to open. Omit starting "/".
 * @param protectedRoute Whether to protect the route. Defaults to true.
 * @param file Optinal: The relative file path for the route.
 */
function openStaticRoute(route: string, protectedRoute: boolean = true, file?: string) {
        if (protectedRoute) {
                app.get('/' + route, (req: Request, res: Response) => {
                        authenticate(req, res, () => {
                                res.sendFile(file ? file : route, { 'root': __dirname + "/../served" })
                        })
                })
        } else {
                app.get('/' + route, (req: Request, res: Response) => {
                        res.sendFile(file ? file : route, { 'root': __dirname + "/../served" })
                })
        }
}

/** Opens server on specified port. */
export function openWebServer(port: number) {
        app.listen(port, () => {
                console.log(`Listening on ${port}!`)
        })
}
