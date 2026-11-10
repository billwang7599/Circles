**Circles**

- `mobile/` Expo app (iOS simulator, phone, or browser)
- `api/` Hono API on Postgres, with migrations, its planner (`api/src/plan/`) and tests. This is what deploys to AWS.
- `shared/` zod schemas and time helpers used by the app and the API

Sign in with a code sent to your email, describe a trip or a day out and pick a date range, let Circles AI set up the
questions, and copy the invite link into the group chat. Invitees answer from the link with no app or account (budgets
stay private); the organizer makes itinerary options from the answers.

**Setup**

```
git clone https://github.com/billwang7599/Circles && cd Circles
npm ci && docker compose up -d && cp api/.env.example api/.env
npm run dev -w api     # http://localhost:3001/api/health
npm run seed -w api -- you@example.com  # optional: a ski trip with three responses, organized by you
npm run ios -w mobile  # first time, and again when a native module is added: builds the iOS dev app, needs Xcode
npm run dev -w mobile  # then press i for the simulator or w for the browser
```

Needs Node 24, Docker Desktop running (it only hosts Postgres; the API applies migrations itself) and Xcode for the
simulator. With `api/.env` as copied, the API runs on a fake model and logs which it chose at startup.

Itinerary options need two people in. Alone, open the invite link in a browser and answer as a second person.

**Sign-in**
The app signs people in on its own screens by calling Amazon Cognito's user-pool API in `ca-central-1`. There's one flow
for new and returning people: the app asks only for an email, and Cognito emails a one-time code (`USER_AUTH` with
`EMAIL_OTP`). If Cognito doesn't know the email, the app signs it up with no password and the emailed code confirms the
address and signs in; an account that never confirmed gets a new confirmation code. Telling an unknown email apart needs
the app client's `PreventUserExistenceErrors: LEGACY`. The app keeps the refresh token in SecureStore and sends the
access token to the API as a Bearer token. The API verifies it with `aws-jwt-verify` and keys `accounts` on the token's
`sub`; on someone's first request it reads their email with Cognito's `GetUser`. There's no browser or redirect, so Expo
Go (simulator or phone) and Expo web now work with real sign-in.

Locally you don't need Cognito: with the `COGNITO_*` values empty (as in `api/.env.example`) the API accepts
`dev:<email>` tokens, the same way it falls back to the fake model, and the app, without
`EXPO_PUBLIC_COGNITO_CLIENT_ID`, shows a dev sign-in that asks only for an email. Any address works and each one is its
own account. Tests use the same dev tokens. In production the API refuses to start without the `COGNITO_*` values.

To sign in for real, fill these from the `circles-auth` stack outputs (below) in `api/.env`:

```
COGNITO_USER_POOL_ID=ca-central-1_...
COGNITO_CLIENT_ID=...
```

and in `mobile/.env` (copy `mobile/.env.example`), then restart Expo with `npx expo start --clear`:

```
EXPO_PUBLIC_COGNITO_CLIENT_ID=...
```

A sign-in code must be entered within 3 minutes (the app client's `AuthSessionValidity`); after that the app asks for a
new one. The pool still allows passwords, since Cognito rejects a sign-in policy without one, but accounts made in the
app have none. The managed login domain and its callback URLs in `infra/auth.yml` only serve builds from before in-app
sign-in.

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

**Alerts**
The `circles-alerts` stack (SES volume and reputation, Cognito and SES budgets; not in the repo) emails the address
it was deployed with. `infra/api-alerts.yml` adds the API's own on the same topic: 5xx answers from the load balancer
or the API, Bedrock spend by the hour (tokens at list prices) and a monthly Bedrock budget. Deploy or update it with:

```
aws cloudformation deploy --profile circles --region ca-central-1 --stack-name circles-api-alerts \
  --template-file infra/api-alerts.yml --parameter-overrides AlertEmail=<who gets the budget emails>
```

**Checks**

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` cover every workspace; CI runs the same four on
every push. One workspace: `npm test -w api`. Tests run on PGlite, so they need no Docker. Format what you touched
with `npx prettier --write <files>`.

**App State**
Locally everything is on your own machine: app → your API → your Docker Postgres. To test real multi-phone flows, phones must share one API which is what AWS is for.

**Real model (optional)**
The API sets up events, reads date ranges and writes itinerary options with Claude on Bedrock when `BEDROCK_MODEL_ID`
is set; hard rules (dates, budgets, party size) stay in code. For Bedrock, accept the AWS
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
ECS in `ca-central-1`). The ECS service needs `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` or the API won't start,
and `PUBLIC_URL` for the invite links and preview images; `APP_STORE_URL` adds the Get the app button to the invite page.
Phones point at the AWS API via `EXPO_PUBLIC_API_URL`. EAS `preview` and `production` builds get it and
`EXPO_PUBLIC_COGNITO_CLIENT_ID` from `env` in `mobile/eas.json`.

**Opening invite links in the app**
The invite page's Open in the app link is `circles://invite?slug=<slug>&g=<token>`, the app's own scheme: on a phone
with the app it opens the app, on one without it Safari says the address is invalid. It cannot be a Universal Link,
because Apple keeps a link tapped on a page of the same site in Safari. The app also opens
`https://<PUBLIC_URL host>/i/<slug>?g=<token>` as a Universal Link when such a link arrives from Messages, Mail or
another app. Two things make that work: the API serves `/.well-known/apple-app-site-association` naming the app,
`<APPLE_TEAM_ID>.ca.circles.app`, once `APPLE_TEAM_ID` (the team's ID from App Store Connect, Membership details) is set
on the ECS service, and the app's `ios.associatedDomains` in `mobile/app.json` names the API host. The entitlement is
baked into the build, so a new host or team needs a new EAS build, and iOS reads the association file when it installs
the app and about weekly after. Only links carrying a `g` open the app; the shared invite link stays a web page, since
the app has no screen for it. The organizer's Add my answers link opens in Safari even from the app, as Apple sends an
app's own Universal Links to the browser.
