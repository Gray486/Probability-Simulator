# Probability Simulator
See `AGENTS.md` for notes on working in this codebase.

Runs as a single Cloudflare Worker:
 - `src/index.ts` serves `client/static`, handles Google login and checks the login token.
 - `src/game-room.ts` is a Durable Object holding the public game and any private lobbies
   (`/game?lobby=CODE`). Clients keep a websocket open to it and are pushed the game state
   whenever it changes; actions are sent as `POST /post`.
 - Accounts, friends, DMs, push subscriptions and the chat log live in a D1 database (`migrations/`).
 - `client/src` is the React client. `npm run build` bundles it to `client/static/js/client.js`
   (wrangler runs this automatically before `dev` and `deploy`).

All wrangler commands that touch Cloudflare go to the **personal** account. The npm scripts unset
`CLOUDFLARE_API_TOKEN` so the robotics token in the environment is never used; `account_id` in
`wrangler.jsonc` pins the account as a second guard.

## First-time setup
```
env -u CLOUDFLARE_API_TOKEN npx wrangler login        # log in to the personal account
env -u CLOUDFLARE_API_TOKEN npx wrangler whoami       # copy the account id into wrangler.jsonc
env -u CLOUDFLARE_API_TOKEN npx wrangler d1 create probability-simulator   # copy database_id into wrangler.jsonc
npm run db:migrate:remote
env -u CLOUDFLARE_API_TOKEN npx wrangler secret put JWT_SECRET
env -u CLOUDFLARE_API_TOKEN npx wrangler secret put VAPID_PRIVATE_KEY
env -u CLOUDFLARE_API_TOKEN npx wrangler secret put VAPID_SUBJECT          # e.g. mailto:you@example.com
npm run deploy
```
Then add the worker's URL to the Google OAuth client's **Authorized JavaScript origins**.

## Local development
Create `.dev.vars`:
```
JWT_SECRET=anything
VAPID_SUBJECT=mailto:you@example.com
VAPID_PRIVATE_KEY=
```
Then `npm run db:migrate:local` once and `npm run dev`. Google sign-in only works on origins
allowed in the Google OAuth client.

## Importing the old SQLite database
The D1 tables match the old Sequelize ones, so rows can be copied over:
```
for t in users friends friend_requests blocked_users subscriptions; do
  sqlite3 storage/database.db ".headers on" ".mode insert $t" "SELECT * FROM $t" >> import.sql
done
env -u CLOUDFLARE_API_TOKEN npx wrangler d1 execute probability-simulator --remote --file import.sql
```
