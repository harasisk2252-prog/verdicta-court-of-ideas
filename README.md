# VERDICTA — THE COURT OF IDEAS

**A cinematic AI courtroom website.** Three debate modes, animated courtroom characters, voice playback, surprise witnesses, logic feedback, a replayable case timeline, and shareable public questions.

The interface takes its aesthetic from classical, warmly lit courthouses: glowing arches, parchment, dark walnut, amber and copper. The courtroom artwork is an original SVG included in the project; the site does not rely on a third-party image URL.

## Run locally on Windows / macOS / Linux

1. Extract the ZIP and open the `verdicta` folder in **VS Code**.
2. Install **Node.js 20+** if you do not have it yet. In a VS Code terminal, run `node -v` to check.
3. From the `verdicta` folder, enter:

   ```bash
   npm start
   ```

4. Visit **http://localhost:3000** in a browser.

That's it. **No `npm install` is required.** This project uses the browser's native APIs and Node's built-in HTTP server, so there are no external JavaScript dependencies. If you want automatic server restart during development, use `npm run dev`.

If port 3000 is occupied, set `PORT=3001` in `.env` and open http://localhost:3001 instead.

## Optional: enable Gemini-powered AI agents

Verdicta runs immediately as a **guided demo with no key**. The demo follows meaningful scripted debate stages, but it does not actually reason about an arbitrary question. For live, topic-specific arguments:

1. Make a copy of `.env.example` and name it `.env`.
2. Set `GEMINI_API_KEY=YOUR_KEY_HERE` in `.env` (create an API key in Google AI Studio).
3. Optionally change `GEMINI_MODEL=gemini-2.5-flash` to another model your account supports.
4. Restart the server with `npm start`.

The key is used **on the server only**, never sent to frontend JavaScript. Please do **not** commit `.env` to GitHub. Gemini API usage is subject to the model's billing/rate limits. Each full AI-vs-AI trial may make multiple Gemini calls.

### Agent design

- **Affirmative advocate:** independently generates the strongest reasonable case for the motion.
- **Opposing advocate:** separately generates the strongest case against it. Its initial generation is not fed the affirmative agent's private output.
- **Judge:** receives both sets of public arguments to produce a cautious verdict, indicative argument-quality meters, and a fictional witness perspective.
- **Human vs AI:** uses the human's actual opening argument, generates an AI opposition, and allows further written rebuttals.
- **Human vs Human:** saves both participants' submissions to a shared room and offers AI moderation when configured.

**The AI judge does not browse or independently verify sources.** This prototype should never imply that an AI-generated claim has been proven. Source-grounding and independent fact verification would require another development phase.

## Features you can use

| Feature | How it works |
|---|---|
| Cinematic homepage | Warm, illustrated courtroom, serif typography, scroll reveals, character spotlights and camera movement |
| AI vs AI | Two AI lawyers, rebuttals, fictional witness and cautious verdict; guided demo without key |
| Human vs AI | Type your opening argument, see the AI challenge, add additional rebuttals |
| Human vs Human | Create an eight-character room, share the invite URL, submit both sides and request a verdict |
| Live spoken dialogue | Browser speech synthesis, different voice pitch/rate per role and speech-boundary subtitle tracking where supported |
| Surprise witness | Optional entrance of another fictional perspective during the trial |
| Case replay | Step through earlier statements using a timeline slider and forward/back controls |
| Private jury ballot | Choose support, oppose, or undecided and compare your position with the AI judge (no simulated crowd votes) |
| Cinematic objection | Raise an Objection! to inspect the latest lawyer argument with the reasoning lens |
| Case dossier download | Export your current hearing transcript and verdict to a text file on your device |
| Reasoning lens | Look for possible logical fallacies; LLM-assisted with Gemini, simple wording-pattern analysis without a key |
| Public gallery | Browse, categorize, and publish debate questions. Launch a new case, challenge it, or invite a friend |
| Case report | Reasoned judgment and three illustrative quality meters |

## How Human vs Human sharing works

1. Select **You vs Friend** and enter a topic.
2. Open the room dialog and click **Create a private room**.
3. Copy the invite link and send it to your friend.
4. Your friend opens the link and types an argument for the opposite side.
5. Room messages are refreshed by **polling every three seconds**.
6. Once both sides have posted, choose **Ask the judge for a verdict**.

For your friend to join from a different device, the Node server must be running on a **publicly accessible hosting service**. A `localhost` link works only on your own computer. Rooms use possession of the invite link as access, not account authentication; do not discuss sensitive information.

## Key project files

```text
verdicta/
├─ public/
│  ├─ index.html       # Entire accessible page and interactive UI
│  ├─ styles.css       # Responsive cinematic design and animations
│  ├─ app.js           # Debate controls, voice, replay, rooms and gallery
│  ├─ courtroom.svg    # Original courtroom art asset
│  └─ favicon.svg      # Verdicta brand icon
├─ data/                # Populated automatically when server starts
├─ server.js            # Backend, AI provider integration, persistence
├─ .env.example         # Optional Gemini configuration
├─ .gitignore           # Excludes private keys and local room state
├─ package.json
└─ README.md
```

## Deploying

Deploy as a **Node.js web service** (for example to Render, Railway, or a VM): start command `npm start`, HTTP port from `PORT`. Keep `GEMINI_API_KEY` in host environment variables. Configure a persistent data volume if you want file-based rooms and gallery to survive redeploys. With purely static hosting such as GitHub Pages or Netlify static, only the browser-side demo can run; **rooms and shared gallery will not persist**.

## Important prototype limitations

- Generated arguments and verdicts **may be inaccurate or biased**. There is **no source retrieval/fact-checking tool** in this build.
- Voice depends on available browser system voices; exact word synchronization is not guaranteed, and there is no microphone/voice recognition yet.
- Room synchronization is 3-second polling, not WebSocket streaming. Public gallery stores questions, not full recordings.
- Local JSON file persistence is designed for prototyping, not large-scale production. No sign-in, abuse controls, encrypted rooms, content moderation, or robust rate limits have been implemented.
- Before exposing it to the public, add authentication, abuse prevention, moderation, persistent database, privacy controls, limits on AI spending, and proper fact-checking where appropriate.

The app is meant as an **extendable, runnable MVP**, not a claim of having implemented a large-scale production platform.

## New in v1.1 — The Jury & Case Dossier

- **Private Jury Ballot:** cast your own support, oppose, or undecided vote; compare it with the final judge conclusion. This is a single-browser opinion and is **not** an aggregate community vote.
- **Objection!:** a brief courtroom effect opens the reasoning lens with the latest lawyer statement, so it can be examined for *possible* flaws. Objections do not decide whether an argument is true.
- **Save Case File:** download a text dossier of testimony, verdict, and optional private jury vote without sending data to a new service.

These extras work in guided-demo and live-AI modes and require no new dependencies. For a real multi-user jury vote, implement authentication, durable vote storage, and abuse prevention before publishing vote counts.

## Netlify deployment

Netlify builds with `npm run check`, publishes `public`, and bundles `netlify/functions/api.mjs`. Pushes to `main` trigger automatic deployment once the repository is connected. `.netlify/`, `.env` files and local data are excluded from Git.

The existing `/api` routes for status, debates, rebuttals, verdicts, reasoning analysis and sample gallery reads run in Netlify Functions. The original cinematic UI and Node server are preserved.

**Current public deployment is a guided demo.** No Gemini key or hosted database is configured. Scripted AI-vs-AI and Human-vs-AI hearings work, including witnesses, replay, jury ballots, objections and dossier downloads. Rooms and public gallery writes return an explicit 503 and their controls are disabled. No ephemeral function storage is presented as persistent storage.

To enable live AI, add `GEMINI_API_KEY` in Netlify environment variables with Functions scope and redeploy. Optionally set `GEMINI_MODEL`. Never put keys in `public` or `netlify.toml`. Provider usage can incur charges; review your provider limits first.

To enable shared storage, provision a hosted database such as Supabase and implement a transactional room/message/gallery storage adapter with schema migrations. Database credentials alone do not activate rooms in this release. Local `npm start` continues to use JSON persistence, including all room routes. No paid database was created.

Run `npm run check` and `npm test`. Tests cover the local Node API and the Netlify adapter; room test data is isolated in a temporary directory.
