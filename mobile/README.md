**Circles**

- `app/` Expo app (iOS simulator, phone, or browser)
- `api/` Hono API on Postgres, with migrations and tests
- `shared/` zod schemas used by both

create a circle, join by code (no passwords), see members, start a plan, submit budget / busy times / preferences privately. 

**Setup**
```
git clone https://github.com/billwang7599/Circles && cd Circles/mobile
npm ci && docker compose up -d && cp api/.env.example api/.env
npm run dev -w api     # http://localhost:3001/api/health
npm run ios -w app     # first time only: builds the iOS dev app, needs Xcode
npm run dev -w app     # then press i for the simulator or w for the browser
```
Docker Desktop must be running (it only hosts Postgres; the API applies migrations itself). Runs on a fake planner and fake places by default. Tests: `npm test -w api`, no Docker needed.

**App State**
Locally everything is on your own machine: app → your API → your Docker Postgres. To test real multi-phone flows, phones must share one API which is what AWS is for.

**Run real Claude on your laptop (optional)**
Accept AWS invite then in terminal `aws configure sso` (portal link, region `us-east-1`, Circles App → AdministratorAccess, profile name `circles`). Then in your `api/.env`:
```
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
AWS_PROFILE=circles
AWS_REGION=ca-central-1
```
Run `aws sso login --profile circles` when it expires (about 12 h). Leave `BEDROCK_MODEL_ID` empty and it falls back to the fake.

**CI and deployment**
Push a branch → Mobile CI runs lint, typecheck, tests, build whenever `mobile/` changes. Merges to `main` don't deploy yet; the API currently deploys from Nicky's repo. AWS API is the pilot environment so phones point at it via `EXPO_PUBLIC_API_URL`.
