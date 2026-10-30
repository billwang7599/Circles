**Circles**

- `mobile/` Expo app (iOS simulator, phone, or browser)
- `api/` Hono API on Postgres, with migrations, its planner (`api/src/plan/`) and tests. This is what deploys to AWS.
- `shared/` zod schemas and time helpers used by the app, the API and the planner
- `ai/` the planner harness (search, availability, ranking, LLM calls). Not wired into `api/` yet.
- `web/` planner test bench: a Vite page plus its own server on :3002 that runs `ai/`

Sign in with a code sent to your email, create a circle, join one by code, start a plan, answer with a budget, busy
times and preferences (the budget stays private), get options, vote, and lock one in.

**Setup**

```
git clone https://github.com/billwang7599/Circles && cd Circles
npm ci && docker compose up -d && cp api/.env.example api/.env
npm run dev -w api     # http://localhost:3001/api/health
npm run seed -w api -- you@example.com  # optional demo circles Roommates and SE Friends, with you in both
npm run ios -w mobile  # first time only: builds the iOS dev app, needs Xcode
npm run dev -w mobile  # then press i for the simulator or w for the browser
```

Needs Node 24, Docker Desktop running (it only hosts Postgres; the API applies migrations itself) and Xcode for the
simulator. With `api/.env` as copied, the API runs on a fake planner model and fake places and logs which it chose at
startup. The compose project is `circles`, so Postgres starts on a fresh volume (the old `mobile_` one isn't reused).

Options need two people in. Alone, press `w` for the browser build, sign in there with another email, and join your
circle with its code.

**Sign-in**
The app signs people in through Amazon Cognito's managed login, which emails a one-time code (Authorization Code with
PKCE), and sends the access token to the API as a Bearer token. The API verifies it with `aws-jwt-verify` and keys
`accounts` on the token's `sub`; on someone's first request it reads their email from Cognito's `userInfo` endpoint.

Locally you don't need Cognito: with the `COGNITO_*` values empty (as in `api/.env.example`) the API accepts
`dev:<email>` tokens, the same way it falls back to the fake planner, and the app, without `EXPO_PUBLIC_COGNITO_*`
values, shows a dev sign-in that asks only for an email. Any address works and each one is its own account. Tests use
the same dev tokens. In production the API refuses to start without the `COGNITO_*` values.

To sign in for real, fill these from the `circles-auth` stack outputs (below) in `api/.env`:

```
COGNITO_USER_POOL_ID=ca-central-1_...
COGNITO_CLIENT_ID=...
COGNITO_DOMAIN=circles.auth.ca-central-1.amazoncognito.com
```

and in `mobile/.env` (copy `mobile/.env.example`), then restart Expo with `npx expo start --clear`:

```
EXPO_PUBLIC_COGNITO_CLIENT_ID=...
EXPO_PUBLIC_COGNITO_DOMAIN=circles.auth.ca-central-1.amazoncognito.com
```

Cognito only sends sign-in back to the redirects it knows: the dev build (`circles://sign-in`), Expo web on
`http://localhost:8081` and Expo Go on the iOS simulator when Metro runs with `npx expo start --localhost`
(`exp://127.0.0.1:8081/--/sign-in`). Expo Go on a real phone gets a LAN address Cognito doesn't know, so use a dev build
there (`npx expo run:ios --device`). Sign-in added native modules, so rebuild the dev app once with
`npm run ios -w mobile`.

Cognito can't turn passwords off: its sign-up page asks for one, and sign-in offers the email code or the password.
While SES is in its sandbox, codes only reach verified addresses.

The user pool, managed login domain and app client are in `infra/auth.yml`. Deploy or update them with:

```
aws cloudformation deploy --profile circles --region ca-central-1 --stack-name circles-auth \
  --template-file infra/auth.yml --parameter-overrides \
  SenderArn=arn:aws:ses:ca-central-1:682334556042:identity/contact@billwang.dev \
  "SenderFrom=Circles <contact@billwang.dev>"
aws cloudformation describe-stacks --profile circles --region ca-central-1 --stack-name circles-auth \
  --query 'Stacks[0].Outputs'
```

The sender must be a verified SES identity in `ca-central-1`; Cognito creates its own role to send through it. The pool
has deletion protection on, so turn that off before deleting the stack.

**Checks**

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` cover every workspace; CI runs the same four on
every push. One workspace: `npm test -w api`. Tests run on PGlite, so they need no Docker. Format what you touched
with `npx prettier --write <files>`.

**Planner test bench**
`cp web/.env.example web/.env`, then `npm run server -w web` (:3002) and `npm run dev -w web` (Vite proxies `/api` to
:3002). Without `BEDROCK_MODEL_ID` or a Places key it runs on the fake model and fake restaurants; set them as for the
API below.

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
ECS in `ca-central-1`). The ECS service needs the three `COGNITO_*` values or the API won't start. `web/` is never
deployed. Phones point at the AWS API via `EXPO_PUBLIC_API_URL`.
