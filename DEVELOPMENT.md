**Circles**

- `mobile/` Expo app (iOS simulator, phone, or browser)
- `api/` Hono API on Postgres, with migrations and tests. This is what deploys to AWS.
- `shared/` zod schemas used by both
- `ai/` the planner harness (search, availability, ranking, LLM calls). Not wired into `api/` yet.
- `web/` planner test bench: a Vite page plus its own server on :3002 that runs `ai/`

create a circle, join by code (no passwords), see members, start a plan, submit budget / busy times / preferences privately. 

**Setup**
```
git clone https://github.com/billwang7599/Circles && cd Circles
npm ci && docker compose up -d && cp api/.env.example api/.env
npm run dev -w api     # http://localhost:3001/api/health
npm run ios -w mobile  # first time only: builds the iOS dev app, needs Xcode
npm run dev -w mobile  # then press i for the simulator or w for the browser
```
Docker Desktop must be running (it only hosts Postgres; the API applies migrations itself). Tests: `npm test` for
every workspace, or `npm test -w api`; no Docker needed. The compose project is now `circles`, so Postgres starts on a
fresh volume (the old `mobile_` one isn't reused).

**Planner test bench**
`cp web/.env.example web/.env`, then `npm run server -w web` (:3002) and `npm run dev -w web` (Vite proxies `/api` to
:3002). Without Cloudflare or Places keys it runs on the fake model and fake restaurants.

**App State**
Locally everything is on your own machine: app → your API → your Docker Postgres. To test real multi-phone flows, phones must share one API which is what AWS is for.

**Run real Claude on your laptop (optional)**
For when the API calls the planner (not wired yet). Accept AWS invite then in terminal `aws configure sso` (portal
link, region `us-east-1`, Circles App → AdministratorAccess, profile name `circles`). Then in your `api/.env`:
```
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
AWS_PROFILE=circles
AWS_REGION=ca-central-1
```
Run `aws sso login --profile circles` when it expires (about 12 h). Leave `BEDROCK_MODEL_ID` empty and it falls back to the fake.

**CI and deployment**
Every push to any branch runs CI: lint, typecheck, tests and build for every workspace. A push to `main` that touches
`api/`, `shared/`, the root `package.json` or lockfile, or the workflows also deploys the API to AWS (image to ECR, then
ECS in `ca-central-1`). `web/` is never deployed. Phones point at the AWS API via `EXPO_PUBLIC_API_URL`.
