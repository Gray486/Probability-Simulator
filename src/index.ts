import { UserLoginRes } from "../types";
import { Env } from "./env";
import { getCookies, handleUser, makeCookie, verifyToken } from "./auth";
import { getUserById } from "./db";

export { GameRoom } from "./game-room";

/** Routes handled by the game durable object. All of them require login. */
const GAME_ROUTES = new Set(["/ws", "/post", "/leave", "/subscribe"]);

/** Static routes and the file in `client/static` they serve. */
const PROTECTED_STATIC: Record<string, string> = {
    "/game": "/client.html",
    "/js/client.js": "/js/client.js",
    "/worker.js": "/js/worker.js"
};
const PUBLIC_STATIC: Record<string, string> = {
    "/": "/home.html",
    "/audio.m4a": "/audio.m4a",
    "/logo.png": "/logo.png",
    "/client.css": "/client.css"
};

/** Serves a file from `client/static`, optionally with a different status code. */
async function serveStatic(request: Request, env: Env, file: string, status?: number): Promise<Response> {
    const res = await env.ASSETS.fetch(new Request(new URL(file, request.url), request));
    return status ? new Response(res.body, { status, headers: res.headers }) : res;
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const { pathname } = new URL(request.url);

        // Used for logging in users
        if (request.method == "POST" && pathname == "/") {
            const form = await request.formData();
            const loginRes: UserLoginRes = await handleUser(
                env,
                getCookies(request).g_csrf_token,
                form.get("g_csrf_token")?.toString(),
                form.get("credential")?.toString()
            );

            if (loginRes.success) {
                return new Response(null, {
                    status: 302,
                    headers: { "Location": "/game", "Set-Cookie": makeCookie("token", loginRes.token) }
                });
            }
            return new Response(loginRes.message, { status: loginRes.status, headers: { "Content-Type": "text/html" } });
        }

        if (GAME_ROUTES.has(pathname)) {
            const id = await verifyToken(request, env);
            if (!id) return serveStatic(request, env, "/401.html", 401);

            // The durable object trusts this header, it is only ever set here after verifying the token
            const headers = new Headers(request.headers);
            headers.set("X-User-Id", id);
            const stub = env.GAME.get(env.GAME.idFromName("main"));
            return stub.fetch(new Request(request, { headers }));
        }

        if (request.method == "GET" || request.method == "HEAD") {
            if (pathname == "/status") {
                return new Response("All systems go!");
            }

            if (pathname in PROTECTED_STATIC) {
                const id = await verifyToken(request, env);
                if (!id || !(await getUserById(env.DB, id))) return serveStatic(request, env, "/401.html", 401);
                return serveStatic(request, env, PROTECTED_STATIC[pathname]);
            }

            if (pathname in PUBLIC_STATIC) {
                return serveStatic(request, env, PUBLIC_STATIC[pathname]);
            }
        }

        // Catch-all 404 page
        return serveStatic(request, env, "/404.html", 404);
    }
} satisfies ExportedHandler<Env>;
