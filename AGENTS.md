# AGENTS.md

Notes for coding agents working on Probability Simulator, a multiplayer push-your-luck wheel game
live at https://prob.grayjn.com.

## Cloudflare account: read this first
Everything deploys to the owner's **personal** Cloudflare account (`account_id` in `wrangler.jsonc`).
The shell's `CLOUDFLARE_API_TOKEN` belongs to a different (robotics) account and must never be used.
Always run wrangler through the npm scripts, or prefix it yourself:
```
env -u CLOUDFLARE_API_TOKEN npx wrangler ...
```

## Layout
One Cloudflare Worker, no other servers.
- `src/index.ts`: worker entry. Google login (`POST /`), static files from `client/static`, and
  forwarding `/ws`, `/post`, `/leave` and `/subscribe` to the Durable Object after checking the
  login token. It passes the user's Google id to the object in the `X-User-Id` header.
- `src/game-room.ts`: the `GameRoom` Durable Object. There is exactly one instance (`idFromName("main")`).
  It holds every game: the public one (code `""`) and private lobbies (5 character codes, picked
  with `?lobby=CODE` on every request). It also handles all social actions (friends, DMs,
  notifications), so it always knows who is online.
- `src/game.ts`: the `Game` class, the rules of one game. It has no I/O; database work goes
  through the `GameHooks` it is given.
- `src/db.ts`: D1 queries. The schema is in `migrations/`. Add a new numbered file for any change.
- `src/auth.ts`: login token (HS256 JWT cookie `token`) and Google ID token checks.
- `src/push.ts`: Web Push (VAPID).
- `types.d.ts`: types shared by the worker and the client, including `SendData` (what clients receive)
  and `PostObject` (every action a client can send).
- `client/src`: React 19 client, bundled by esbuild into `client/static/js/client.js` (gitignored,
  rebuilt by `npm run build`, which wrangler also runs before `dev` and `deploy`).
- `client/static`: HTML, CSS, audio and the service worker (`js/worker.js`).

## How the game talks to clients
- Clients keep a websocket open (`/ws`) and are sent their whole `SendData` after every change.
  Actions go in as `POST /post` with a `PostObject` body. Clients never send game actions over the socket.
- Websockets use the hibernation API. Anything kept on a socket goes in its attachment
  (`SocketAttachment`), and game state is saved to `ctx.storage.kv` so it survives eviction.
  A game that was mid-match when the object was evicted goes back to its lobby.
- `Game.visibleData()` freezes what clients see while players are choosing, so nobody can see
  other players' moves. Don't send `game.players` any other way.
- Game timers go through `Game.later()` and are all cancelled when a turn, round or game moves on.
  Don't add a bare `setTimeout` to the game flow, or stale timers come back (that was the
  "two timers after 2+ games" bug).
- Profiles are cached in the object for 10s. Call `invalidate(username)` after changing a user in D1.
- Private lobbies are unranked: they don't change rank points, wins or stats. The host is the
  lobby's creator, or whoever has been there longest once the creator leaves. Empty lobbies are
  deleted after a 60s grace period.

## Commands
```
npm install
npm run dev               # local worker on :8787 (uses .dev.vars and a local D1)
npm run db:migrate:local  # once, and after adding a migration
npm run typecheck         # worker and client
npm run build             # client bundle only
npm run deploy            # production (personal account)
npm run db:migrate:remote # production migrations
```
`.dev.vars` needs `JWT_SECRET`, `VAPID_SUBJECT` and `VAPID_PRIVATE_KEY` (empty is fine, push is skipped).

## Testing
There is no test suite. Test changes by running `npm run dev` and scripting clients with Node:
sign a JWT `{ id }` with the `JWT_SECRET` from `.dev.vars` (using `jose`), send it as the `token`
cookie, open `ws://localhost:8787/ws`, and send actions to `/post`. Keep the `key` cookie that
`join` sets; in-game actions need it. Local D1 needs user rows for those ids.
Google sign-in only works on origins allowed in the Google OAuth client, so it can't be tested locally.
Always run `npm run typecheck` before finishing.

## Style
- 4 space indents, double quotes, `==` comparisons, JSDoc on anything non-obvious. Match the file you're in.
- Never render user text as HTML. React escapes it, so keep it that way (no `dangerouslySetInnerHTML`).
- Keep UI changes restrained. The owner prefers the existing compact look over big, bold, light
  redesigns.
- Bump `version` in `src/env.ts` for releases.

## Changelog doc
The changelog lives in a Google Doc, "Probability Simulator Information Doc"
(https://docs.google.com/document/d/17GohYuKWWQH3DWwV-bax1oZEPfPmz8amYc8Acjhhsxg/edit), not in the repo.
- Add each release as a new "V<version> (In game)" entry at the top of **Recently Added**, matching
  the entries below it: bold italic version line, bulleted items, sub-items nested under a parent
  (e.g. "Notifications"). Minor bug fixes are written in italics as "Bug Fix: ...", serious ones in
  bold italics.
- Remove finished items from the **Todo** list.
- **Recently Added** keeps only the newest three versions. Move anything older to the **Older Versions:**
  section at the bottom of the doc, newest first. For example, once V3.2 is added, V2.2 moves down.
