export interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    GAME: DurableObjectNamespace;
    G_CLIENT_ID: string;
    JWT_SECRET: string;
    VAPID_SUBJECT: string;
    VAPID_PUBLIC_KEY: string;
    VAPID_PRIVATE_KEY: string;
}

/** Version number that shows up on settings page */
export const version = "3.1";
