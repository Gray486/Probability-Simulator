import * as jwt from "jsonwebtoken";
import * as googleAuth from "google-auth-library";
import { Message, UserLoginRes } from "../types";
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { directMessageChannels, KEYS } from "./files";
import { lastOnline } from "./push";
import UserModel from "./database/UserModel";

const { JWT_SECRET, G_CLIENT_ID } = KEYS;

export interface AuthenticatedRequest extends Request {
    user?: UserModel;
    key?: string;
}

/**
 * Put inside of route to make it protected.
 * @param req Express request.
 * @param res Express response.
 * @param next The route to call after authentication.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    // Makes sure token cookie exists
    if (!req.cookies.token) {
        res.status(401).sendFile("401.html", { 'root': __dirname + "/../client/static" })
        return;
    }

    // Finds user game key
    const key: string = req.cookies.key;

    // Decodes payload from cookie
    let payload: string | jwt.JwtPayload | null = null;
    try {
        payload = jwt.verify(req.cookies.token, JWT_SECRET)
    } catch (err) {
        console.error(err)
    }
    let id: string;

    // Makes sure payload is an object
    if (typeof payload == "string" || !payload) {
        res.status(401).sendFile("401.html", { 'root': __dirname + "/../client/static" })
        return;
    } else {
        id = payload.id;
    }

    // Finds user
    const user = await UserModel.getUser(id, "id");

    if (!user) {
        res.status(401).sendFile("401.html", { 'root': __dirname + "/../client/static" })
        return;
    }

    lastOnline[user.username] = new Date().getTime();

    // Continues on to the actual route, giving it the user and their game key
    req.user = user;
    req.key = key;
    next()
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

    const user: UserModel | null = await UserModel.findOne({ where: { id: userData.sub } });

    if (!user) {
        let defaultUsername: string;

        // Creates username based on real name, but defaults to `User`.
        if (userData.family_name && userData.given_name) {
            defaultUsername = userData.given_name + userData.family_name.charAt(0);
        } else {
            defaultUsername = "User"
        }

        let uniqueUsername: string = defaultUsername;

        // Adds 1 to username until it is unique
        let uniqueUsernameIndex: number = 1;
        while (await UserModel.findOne({ where: { username: uniqueUsername } }) != null) {
            uniqueUsername = defaultUsername + uniqueUsernameIndex.toString();
            uniqueUsernameIndex++
        }

        // Creates new user account
        UserModel.createUser(userData.sub, uniqueUsername, userData.name || uniqueUsername)
    }

    // Creates new login token
    const jwtToken: string = jwt.sign({ id: userData.sub }, JWT_SECRET, { expiresIn: "10h" });

    return { success: true, status: 200, token: jwtToken };
}

/** 
 * Handles a friend. Can accept and deny requests and remove friends.  
 * @param user The user that is handling a friend.
 * @param friend Friend to handle.
 * @param accept Wether to accept request or deny request / remove friend.
 */
export async function handleFriend(user: UserModel, friend: UserModel, accept: boolean): Promise<void> {
    if (accept) {
        user.friend(friend)
    } else {
        user.unfriend(friend)
    }
}

/**
 * Invite a friend to the game.
 * @param user The user that is inviting a friend.
 * @param friendUsername The friend that is being invited.
 */
export async function inviteFriend(user: UserModel, friend: UserModel | null): Promise<"OK" | "friendNotFound"> {
    if (!friend || !user.hasFriend(friend)) {
        return "friendNotFound";
    }
    friend.notify("Invited to Probability Simulator!", `${user.username} has invited you to play!`);
    return "OK";
}

/**
 * Message a friend.
 * @param user The user that is messaging.
 * @param friendUsername The friend being messaged
 * @param content The message to send.
 */
export async function messageFriend(user: UserModel, friend: UserModel | null, content: string): Promise<"friendNotFound" | "OK"> {
    if (!friend || !user.hasFriend(friend)) {
        return "friendNotFound";
    }

    if (content.length > 50) {
        content = content.slice(0, 50);
    }

    friend.notify(`${user.username} sent you a message.`, content)

    let message: Message = {
        from: user.username,
        content: content,
        timestamp: new Date().getTime(),
        read: false
    }

    const dmIndex = directMessageChannels.findIndex(
        (dmChannel) => (
            (
                dmChannel.initiatedBy == user.username && dmChannel.receiver == friend.username
            ) || (
                dmChannel.receiver == user.username && dmChannel.initiatedBy == friend.username
            )
        )
    )

    if (dmIndex < 0) {
        directMessageChannels.push({
            initiatedBy: user.username,
            receiver: friend.username,
            messages: [message]
        })
    } else {
        if (directMessageChannels[dmIndex].messages.length > 50) {
            directMessageChannels[dmIndex].messages.splice(0, 1)
        }
        directMessageChannels[dmIndex].messages.push(message)
    }

    return "OK";
}

export function readMessages(user: UserModel, friendUsername: string, messageReverseIndices: number[]) {
    const dmIndex: number = directMessageChannels.findIndex((dmChannel) => (
        (
            dmChannel.initiatedBy == user.username && dmChannel.receiver == friendUsername
        ) || (
            dmChannel.receiver == user.username && dmChannel.initiatedBy == friendUsername
        )
    ))

    if (dmIndex == -1) return;

    for (let i = 0; i < messageReverseIndices.length; i++) {
        const messagesLenth: number = directMessageChannels[dmIndex].messages.length;
        const messageIndex: number = messagesLenth - messageReverseIndices[i];

        if (messageIndex < 0) continue;
        directMessageChannels[dmIndex].messages[messageIndex].read = true;
    }
}