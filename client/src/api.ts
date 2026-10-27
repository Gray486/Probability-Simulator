import { useEffect, useState } from "react";
import { PostObject, SendData } from "../../types";

/** Sends an action to the server and returns the `res` field of the response. */
export async function post(data: PostObject): Promise<any> {
    const res = await fetch("/post", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    return (await res.json()).res;
}

/** Keeps a websocket open to the server and returns the latest game data it sent. */
export function useGameData(): SendData | null {
    const [data, setData] = useState<SendData | null>(null);

    useEffect(() => {
        let ws: WebSocket;
        let stopped = false;
        /** Number of connection attempts in a row that never opened. */
        let failures = 0;

        function connect() {
            const protocol = location.protocol == "https:" ? "wss:" : "ws:";
            ws = new WebSocket(`${protocol}//${location.host}/ws`);
            let opened = false;

            ws.onopen = () => {
                opened = true;
                failures = 0;
            };
            ws.onmessage = (e) => {
                if (e.data == "pong") return;
                setData(JSON.parse(e.data));
            };
            ws.onclose = async (e) => {
                if (stopped) return;
                if (!opened) failures++;

                // Login token expired, send them back to the login page
                const loggedOut = e.code == 4001 || (failures >= 3 && (await fetch("/game", { method: "HEAD" })).status == 401);
                if (loggedOut) {
                    location.href = "/";
                    return;
                }
                setTimeout(connect, Math.min(1000 * 2 ** failures, 10000));
            };
        }
        connect();

        // Keeps the connection from being closed for being idle
        const ping = setInterval(() => {
            if (ws.readyState == WebSocket.OPEN) ws.send("ping");
        }, 30000);

        return () => {
            stopped = true;
            clearInterval(ping);
            ws.close();
        };
    }, []);

    return data;
}
