import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { UserLoginRes } from "../types";
import { Env } from "./env";
import { createUser, getUserById, getUserByUsername } from "./db";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Parses the Cookie header into a key value object. */
export function getCookies(request: Request): Record<string, string> {
    const cookies: Record<string, string> = {};
    const header = request.headers.get("Cookie");
    if (!header) return cookies;

    for (const part of header.split(";")) {
        const index = part.indexOf("=");
        if (index < 0) continue;
        cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    }
    return cookies;
}

export function makeCookie(name: string, value: string): string {
    return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

const secretKey = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);

/**
 * Verifies the login token cookie.
 * @returns The user's google id, or `null` if the token is missing or invalid.
 */
export async function verifyToken(request: Request, env: Env): Promise<string | null> {
    const token = getCookies(request).token;
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, secretKey(env), { algorithms: ["HS256"] });
        return typeof payload.id == "string" ? payload.id : null;
    } catch {
        return null;
    }
}

/**
 * Finds or create user account from google token.
 * @param csrfTokenCookie CSRF token in cookie of req.
 * @param csrfTokenBody CSRF token in body of req.
 * @param token Google auth token.
 * @returns Sign-in token or error message.
 */
export async function handleUser(env: Env, csrfTokenCookie: string | undefined, csrfTokenBody: string | undefined, token: string | undefined): Promise<UserLoginRes> {
    if (!csrfTokenCookie || !csrfTokenBody) {
        return { success: false, status: 400, message: "Missing CSRF token. <a href='./'>Click here</a> to login again." };
    }

    if (csrfTokenCookie != csrfTokenBody) {
        return { success: false, status: 400, message: "Failed to verify double submit cookie. <a href='./'>Click here</a> to login again." };
    }

    if (!token) {
        return { success: false, status: 400, message: "No Google auth token. <a href='./'>Click here</a> to login again." };
    }

    // Uses google's public keys to verify the token and get user data
    let userData;
    try {
        const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
            issuer: ["accounts.google.com", "https://accounts.google.com"],
            audience: env.G_CLIENT_ID
        });
        userData = payload as { sub?: string; name?: string; given_name?: string; family_name?: string };
    } catch (err) {
        console.error(err);
    }

    if (!userData?.sub) {
        return { success: false, status: 500, message: "Could not get google payload. <a href='./'>Click here</a> to login again." };
    }

    if (!(await getUserById(env.DB, userData.sub))) {
        // Creates username based on real name, but defaults to `User`.
        const defaultUsername: string = userData.family_name && userData.given_name
            ? userData.given_name + userData.family_name.charAt(0)
            : "User";

        let uniqueUsername: string = defaultUsername;

        // Adds 1 to username until it is unique
        let uniqueUsernameIndex: number = 1;
        while (await getUserByUsername(env.DB, uniqueUsername)) {
            uniqueUsername = defaultUsername + uniqueUsernameIndex.toString();
            uniqueUsernameIndex++
        }

        // Creates new user account
        await createUser(env.DB, userData.sub, uniqueUsername, userData.name || uniqueUsername)
    }

    // Creates new login token
    const jwtToken: string = await new SignJWT({ id: userData.sub })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("10h")
        .sign(secretKey(env));

    return { success: true, status: 200, token: jwtToken };
}
