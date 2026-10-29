**Circles**

- `mobile/` Expo app (iOS simulator, phone, or browser)
- `api/` Hono API on Postgres, with migrations, its planner (`api/src/plan/`) and tests. This is what deploys to AWS.
- `shared/` zod schemas and time helpers used by the app, the API and the planner
- `ai/` the planner harness (search, availability, ranking, LLM calls). Not wired into `api/` yet.
- `web/` planner test bench: a Vite page plus its own server on :3002 that runs `ai/`

Create a circle, join by code (no passwords), start a plan, answer with a budget, busy times and preferences (the budget
stays private), get options, vote, and lock one in.

**Setup**

```
git clone https://github.com/billwang7599/Circles && cd Circles
npm ci && docker compose up -d && cp api/.env.example api/.env
npm run dev -w api     # http://localhost:3001/api/health
npm run seed -w api    # optional demo data: Roommates (code FSQWWV) and SE Friends (YQLJVS)
npm run ios -w mobile  # first time only: builds the iOS dev app, needs Xcode
npm run dev -w mobile  # then press i for the simulator or w for the browser
```

Needs Node 24, Docker Desktop running (it only hosts Postgres; the API applies migrations itself) and Xcode for the
simulator. With `api/.env` as copied, the API runs on a fake planner model and fake places and logs which it chose at
startup. The compose project is `circles`, so Postgres starts on a fresh volume (the old `mobile_` one isn't reused).

Options need two people in. Alone, press `w` for the browser build, which is a separate account, and join your circle
with its code there.

**Checks**

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` cover every workspace; CI runs the same four on
every push. One workspace: `npm test -w api`. Tests run on PGlite, so they need no Docker. Format what you touched
with `npx prettier --write <files>`.

**Planner test bench**
`cp web/.env.example web/.env`, then `npm run server -w web` (:3002) and `npm run dev -w web` (Vite proxies `/api` to
:3002). Without Cloudflare or Places keys it runs on the fake model and fake restaurants.

**App State**
Locally everything is on your own machine: app → your API → your Docker Postgres. To test real multi-phone flows, phones must share one API which is what AWS is for.

**Real model and places (optional)**
The API ranks options with Claude on Bedrock when `BEDROCK_MODEL_ID` is set and looks places up on Google Places when
`GOOGLE_PLACES_API_KEY` is set (`GOOGLE_PLACES_MAX_REQUESTS` caps the calls per run). For Bedrock, accept the AWS
invite, then in a terminal `aws configure sso` (portal link, region `us-east-1`, Circles App → AdministratorAccess,
profile name `circles`) and in your `api/.env`:

```
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
AWS_PROFILE=circles
AWS_REGION=ca-central-1
```

Run `aws sso login --profile circles` when it expires (about 12 h). Leave the values empty and the API falls back to
the fakes.

**CI and deployment**
Every push to any branch runs CI: lint, typecheck, tests and build for every workspace. A push to `main` that touches
`api/`, `shared/`, the root `package.json` or lockfile, or the workflows also deploys the API to AWS (image to ECR, then
ECS in `ca-central-1`). `web/` is never deployed. Phones point at the AWS API via `EXPO_PUBLIC_API_URL`.
