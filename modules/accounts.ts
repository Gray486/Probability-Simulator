import * as jwt from "jsonwebtoken";
import * as googleAuth from "google-auth-library";
import { DirectMessageChannel, User, UserLoginRes } from "./types";
import { Request, Response } from 'express';
import { addUser, getDirectMessageChannels, getUserDBAsync, KEYS, setDirectMessageChannels, setUserDB } from "./files";
import { sendPushNotification } from "./push";

const { JWT_SECRET, G_CLIENT_ID } = KEYS;

/**
 * Put inside of route to make it protected.
 * @param req Express request.
 * @param res Express response.
 * @param next The route to call after authentication.
 */
export function authenticate(req: Request, res: Response, next: (user: User, userIndex?: number, key?: string) => void): void {
        // Makes sure token cookie exists
        if (!req.cookies.token) {
                res.status(401).sendFile("401.html", { 'root': __dirname + "/../served" })
                return;
        }

        // Finds user game key
        const key: string = req.cookies.key || null;

        // Decodes payload from cookie
        const payload = jwt.verify(req.cookies.token, JWT_SECRET)
        let id: string;

        // Makes sure payload is an object
        if (typeof payload == "string") {
                res.status(401).sendFile("401.html", { 'root': __dirname + "/../served" })
                return;
        } else {
                id = payload.id;
        }

        getUserDBAsync((accounts) => {
                // Finds user
                const userIndex: number = accounts.findIndex((value: User) => value.id == id)

                if (userIndex != -1) {
                        res.status(401).sendFile("401.html", { 'root': __dirname + "/../served" })
                        return;
                }

                // Continues on to the actual route, giving it the user and their game key
                next(accounts[userIndex], userIndex, key)
        })
}

/** 
 * Finds or create user account from google token.
 * @param csrfTokenBody CSRF token in body of req.
 * @param csrfTokenCookie CSRF token in cookie of req.
 * @param token Google auth token.
 * @returns Sign-in token or error message. 
 */
export async function handleUser(csrfTokenCookie: string | undefined, csrfTokenBody: string | undefined, token: string | undefined): Promise<UserLoginRes> {
        if (!csrfTokenCookie || !csrfTokenBody) {
                return { success: false, status: 400, message: "Missing CSRF token. <a href='./'>Click here</a> to login again." };
        }

        if (csrfTokenCookie != csrfTokenBody) {
                return { success: false, status: 400, message: "Failed to verify double submit cookie. <a href='./'>Click here</a> to login again." };
        }

        if (!token) {
                return { success: false, status: 400, message: "No Google auth token. <a href='./'>Click here</a> to login again." };
        }

        // Uses google auth to find google account and get user data
        const client = new googleAuth.OAuth2Client();
        async function verify(): Promise<googleAuth.TokenPayload | undefined> {
                if (typeof token == "string") {
                        const ticket = await client.verifyIdToken({
                                idToken: token,
                                audience: G_CLIENT_ID
                        });

                        const payload: googleAuth.TokenPayload | undefined = ticket.getPayload();
                        return payload;
                }
        }

        let userData: googleAuth.TokenPayload | undefined | void = await verify().catch(console.error);

        if (!userData) {
                return { success: false, status: 500, message: "Could not get google payload. <a href='./'>Click here</a> to login again." };
        }

        getUserDBAsync((users) => {
                const userIndex: number = users.findIndex((value: User) => value.id == userData.sub);

                if (userIndex == -1) {
                        let defaultUsername: string;

                        // Creates username based on real name, but defaults to "User"
                        if (userData.family_name && userData.given_name) {
                                defaultUsername = userData.given_name + userData.family_name.charAt(0);
                        } else {
                                defaultUsername = "User"
                        }

                        let uniqueUsername: string = defaultUsername;

                        // Adds 1 to username until it is unique
                        let uniqueUsernameIndex: number = 1;
                        while (users.findIndex((value: User) => value.username == uniqueUsername) > -1) {
                                uniqueUsername = defaultUsername + uniqueUsernameIndex.toString();
                                uniqueUsernameIndex++
                        }

                        // Creates new user account
                        const newAccount: User = {
                                username: uniqueUsername,
                                realName: userData.name || uniqueUsername,
                                id: userData.sub,
                                friends: [],
                                friendRequests: [],
                                blockedUsers: [],
                                score: 0,
                                wins: 0,
                                silent: false,
                                lastInvite: null,
                                acceptingFriendRequests: true
                        }

                        addUser(newAccount)
                }
        })

        // Creates new login token
        const jwtToken: string = jwt.sign({ id: userData.sub }, JWT_SECRET, { expiresIn: "10h" });

        return { success: true, status: 200, token: jwtToken };
}

/** 
 * Handles a friend. Can accept and deny requests and remove friends.  
 * @param username Username of user that is handling a friend.
 * @param friendUsername Username of friend to handle.
 * @param accept Wether to accept request or deny request / remove friend.
 */
export async function handleFriend(userIndex: number, friendUsername: string, accept: boolean): Promise<"userNotFound" | "OK" | "noFriendRequest"> {
        // Gets userDB asyncronously by creating a promise that yeilds the userDB.
        const userDB = await new Promise<User[]>((resolve) => {
                getUserDBAsync((userDB) => {
                        resolve(userDB);
                });
        });

        const username: string = userDB[userIndex].username;

        // Gets DB indexes of both users
        const friendIndex: number = userDB.findIndex((user: User) => user.username == friendUsername)

        if (friendIndex < 0 || userIndex < 0) {
                return "userNotFound";
        }

        const userFriendIndex = userDB[userIndex].friendRequests.indexOf(friendUsername)

        if (accept) {
                if (!userDB[userIndex].friendRequests.includes(friendUsername)) {
                        return "noFriendRequest";
                }
                // Adds friend to friend list.
                if (!userDB[userIndex].friends.includes(friendUsername)) {
                        userDB[userIndex].friends.push(friendUsername)
                }
                // Unblocks user if not already done.
                if (userDB[userIndex].blockedUsers.includes(friendUsername)) {
                        userDB[userIndex].blockedUsers.splice(userDB[userIndex].blockedUsers.indexOf(friendUsername))
                }
                // Adds user to friend's friend list.
                if (!userDB[friendIndex].friends.includes(username)) {
                        userDB[friendIndex].friends.push(username)
                }
        } else {
                // Blocks user if not already done.
                if (!userDB[userIndex].blockedUsers.includes(friendUsername)) {
                        userDB[userIndex].blockedUsers.push(friendUsername)
                }
                // Removes friend from user's friend list if applicable
                const userFriendIndex = userDB[userIndex].friends.indexOf(friendUsername)
                userDB[userIndex].friends.splice(userFriendIndex, userFriendIndex < 0 ? 0 : 1)
        }

        userDB[userIndex].friendRequests.splice(userFriendIndex, userFriendIndex < 0 ? 0 : 1)

        setUserDB(userDB);

        return "OK";
}

/**
 * Sends a friend request to the specified user.  
 * @param username Username of user that is adding a friend.
 * @param friendUsername Username of friend to add.
 */
export async function addFriend(userIndex: number, friendUsername: string): Promise<"userNotFound" | "friendNotFound" | "friendNotAcceptingRequests" | "OK"> {
        // Gets userDB asyncronously by creating a promise that yeilds the userDB. 
        const userDB = await new Promise<User[]>((resolve) => {
                getUserDBAsync((userDB) => {
                        resolve(userDB);
                });
        });

        const username: string = userDB[userIndex].username;

        // Gets DB indexes of both users
        const friendIndex: number = userDB.findIndex((user: User) => user.username == friendUsername)

        if (friendIndex < 0) {
                return "friendNotFound";
        }

        if (userIndex < 0) {
                return "userNotFound";
        }

        if (!userDB[friendIndex].acceptingFriendRequests) {
                return "friendNotAcceptingRequests";
        }

        // Removes invitee from blocked list.
        if (userDB[userIndex].blockedUsers.includes(friendUsername)) {
                userDB[userIndex].blockedUsers.splice(userDB[userIndex].blockedUsers.indexOf(friendUsername))
        }

        console.log("user already requested: " + userDB[friendIndex].friendRequests.includes(username))

        if (userDB[userIndex].friendRequests.includes(friendUsername)) {
                handleFriend(userIndex, friendUsername, true)
        } else if (!userDB[friendIndex].friendRequests.includes(username)) {
                userDB[friendIndex].friendRequests.push(username)
        }

        setUserDB(userDB);

        return "OK";
}

/**
 * Invite a friend to the game.
 * @param user The user that is inviting a friend.
 * @param friendUsername The friend that is being invited.
 */
export async function inviteFriend(user: User, friendUsername: string): Promise<"OK" | "friendNotFound" | "friendCannotBeInvited"> {
        console.log("friend invited")

        if (!user.friends.includes(friendUsername)) {
                return "friendNotFound";
        }

        const userDB = await new Promise<User[]>((resolve) => {
                getUserDBAsync((userDB) => {
                        resolve(userDB);
                })
        });

        let reciverUserIndex = userDB.findIndex((user: User) => user.username == friendUsername)

        if (userDB[reciverUserIndex].lastInvite && new Date().getTime() - userDB[reciverUserIndex].lastInvite < 300000) {
                return "friendCannotBeInvited"
        }

        userDB[reciverUserIndex].lastInvite = new Date().getTime();
        setUserDB(userDB)

        sendPushNotification(friendUsername, "Invited to Casino Simulator!", `${user.username} has invited you to play!`);

        return "OK";
}

/**
 * Message a friend.
 * @param user The user that is messaging.
 * @param friendUsername The friend being messaged
 * @param message The message to send.
 */
export async function messageFriend(user: User, friendUsername: string, message: string): Promise<"friendNotFound" | "OK"> {
        // Gets userDB asyncronously by creating a promise that yeilds the userDB. 
        const userDB = await new Promise<User[]>((resolve) => {
                getUserDBAsync((userDB) => {
                        resolve(userDB);
                });
        });

        // Gets DB indexes of both users
        const friendIndex: number = userDB.findIndex((user: User) => user.username == friendUsername)

        if (friendIndex < 0 || !user.friends.includes(friendUsername)) {
                return "friendNotFound";
        }

        if (message.length > 50) {
                message = message.slice(0, 50);
        }

        message = `${user.username}: ${message}`

        const directMessageChannels = await new Promise<DirectMessageChannel[]>((resolve) => {
                getDirectMessageChannels((directMessageChannels) => {
                        resolve(directMessageChannels);
                });
        });

        const dmIndex = directMessageChannels.findIndex(
                (dmChannel) => (
                        (
                                dmChannel.initiatedBy == user.username && dmChannel.receiver == friendUsername
                        ) || (
                                dmChannel.receiver == user.username && dmChannel.initiatedBy == friendUsername
                        )
                )
        )

        if (dmIndex < 0) {
                directMessageChannels.push({
                        initiatedBy: user.username,
                        receiver: friendUsername,
                        messages: [message]
                })
        } else {
                if (directMessageChannels[dmIndex].messages.length > 50) {
                        directMessageChannels[dmIndex].messages.splice(0, 1)
                }
                directMessageChannels[dmIndex].messages.push(message)
        }

        setDirectMessageChannels(directMessageChannels)

        return "OK";
}

/**
 * Silences or unsilences users. 
 * @param userIndex The user to change the silent mode for.
 * @param silent Wether or not to silent the user.
 */
export function setSilentMode(userIndex: number, silent: boolean): void {
        getUserDBAsync((userDB) => {
                userDB[userIndex].silent = silent;
                setUserDB(userDB);
        })
}

/**
 * Allows or disallows friend requests. 
 * @param userIndex The user to change the friend request mode for.
 * @param acceptingFriendRequests Wether or not to allow friend requests.
 */
export function setFriendRequestMode(userIndex: number, acceptingFriendRequests: boolean) {
        getUserDBAsync((userDB) => {
                userDB[userIndex].acceptingFriendRequests = acceptingFriendRequests;
                setUserDB(userDB);
        })
}

/**
 * Unblocks a user. 
 * @param userIndex The user to remove the block from.
 * @param blocked The blocked user.
 */
export function unblockUser(userIndex: number, blocked: string) {
        getUserDBAsync((userDB) => {
                let blockListIndex = userDB[userIndex].blockedUsers.indexOf(blocked);
                if (blockListIndex != -1) {
                        userDB[userIndex].blockedUsers.splice(blockListIndex, 1)
                        setUserDB(userDB);
                }
        })
}