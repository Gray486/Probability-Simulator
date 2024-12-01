import * as jwt from "jsonwebtoken";
import * as googleAuth from "google-auth-library";
import { User, UserLoginRes } from "./types";
import { addUser, getUserDB, KEYS } from "./files";

const { JWT_SECRET, G_CLIENT_ID } = KEYS;

// Put inside of route to make it protected
export function authenticate(req: any, res: any, next: (user: User, key?: string) => void): void {
    // Makes sure token cookie exists
    if (!req.cookies.token) {
        res.status(401).sendFile(__dirname + "/static/401.html")
        return;
    }

    // Finds user game key
    const key: string = req.cookies.key || null;

    // Decodes payload from cookie
    const payload = jwt.verify(req.cookies.token, JWT_SECRET)
    let id: string;

    // Makes sure payload is an object
    if (typeof payload == "string") {
        res.status(401).sendFile(__dirname + "/static/401.html")
        return;
    } else {
        id = payload.id;
    }

    // Finds user
    const accounts: User[] = getUserDB();
    const user: User | undefined = accounts.find((value: User) => value.id = id)

    if (!user) {
        res.status(401).sendFile(__dirname + "/static/401.html")
        return;
    }

    // Continues on to the actual route, giving it the user and their key
    next(user, key)
}

// Finds or create user account and returns sign in token or error
export async function handleUser(csrfTokenCookie: string | undefined, csrfTokenBody: string | undefined, token: string | undefined): Promise<UserLoginRes> {
    if (!csrfTokenCookie || !csrfTokenBody) {
        return {success: false, status: 400, message: "Missing CSRF token. <a href='./'>Click here</a> to login again."};
    }

    if (csrfTokenCookie != csrfTokenBody) {
        return {success: false, status: 400, message: "Failed to verify double submit cookie. <a href='./'>Click here</a> to login again."};
    }

    if (!token) { 
        return {success: false, status: 400, message: "No Google ID token. <a href='./'>Click here</a> to login again."};
    }

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
        return {success: false, status: 500, message: "Could not get google payload. <a href='./'>Click here</a> to login again."}; 
    }

    let users: User[] = getUserDB();

    const userIndex: number = users.findIndex((value: User) => value.id == userData.sub);

    if (userIndex == -1) {

        let defaultUsername: string;

        if (userData.family_name && userData.given_name) {
            defaultUsername = userData.given_name + userData.family_name.charAt(0);
        } else {
            defaultUsername = "User"
        }

        let uniqueUsername: string = defaultUsername;

        let uniqueUsernameIndex: number = 1;
        while (users.findIndex((value: User) => value.username == uniqueUsername) > -1) {
            console.log(uniqueUsername)
            uniqueUsername = defaultUsername + uniqueUsernameIndex.toString();
            uniqueUsernameIndex++
        }

        const newAccount: User = {
            username: uniqueUsername,
            name: userData.name || uniqueUsername,
            id: userData.sub,
            score: 0,
            wins: 0
        }

        addUser(newAccount)
    }

    const jwtToken: string = jwt.sign({id: userData.sub}, JWT_SECRET, { expiresIn: "10h" });

    return {success: true, status: 200, token: jwtToken};
}