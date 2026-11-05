import { afterEach, beforeEach, expect, test, vi } from "vitest";

const stored = vi.hoisted(() => new Map<string, string>());
vi.mock("./storage", () => ({
  readValue: (key: string) => stored.get(key) ?? null,
  writeValue: (key: string, value: string) => stored.set(key, value),
}));

type Call = { action: string; body: Record<string, unknown> };
type Handlers = Record<string, (body: Record<string, unknown>) => Response>;

const fault = (type: string) =>
  Response.json({ __type: type, message: type }, { status: 400 });
const tokens = (ExpiresIn = 3600, AccessToken = "access") =>
  Response.json({
    AuthenticationResult: { AccessToken, ExpiresIn, RefreshToken: "refresh" },
  });
const challenge = () =>
  Response.json({ ChallengeName: "EMAIL_OTP", Session: "otp" });

function fakeCognito(handlers: Handlers) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const action = headers["X-Amz-Target"].split(".")[1];
      const body = JSON.parse(init.body as string);
      calls.push({ action, body });
      return handlers[action](body);
    }),
  );
  return calls;
}

async function load() {
  vi.resetModules();
  return import("./session");
}

beforeEach(() => {
  stored.clear();
  vi.stubEnv("EXPO_PUBLIC_COGNITO_CLIENT_ID", "client");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("a known email gets a sign-in code, and the code signs in", async () => {
  const calls = fakeCognito({
    InitiateAuth: challenge,
    RespondToAuthChallenge: () => tokens(),
  });
  const session = await load();
  const step = await session.sendCode("ana@example.com");
  expect(step).toEqual({
    email: "ana@example.com",
    confirmsSignUp: false,
    session: "otp",
  });
  expect(await session.enterCode(step, "12345678")).toBeUndefined();
  expect(await session.accessToken()).toBe("access");
  expect(calls).toEqual([
    {
      action: "InitiateAuth",
      body: {
        ClientId: "client",
        AuthFlow: "USER_AUTH",
        AuthParameters: {
          USERNAME: "ana@example.com",
          PREFERRED_CHALLENGE: "EMAIL_OTP",
        },
      },
    },
    {
      action: "RespondToAuthChallenge",
      body: {
        ClientId: "client",
        ChallengeName: "EMAIL_OTP",
        Session: "otp",
        ChallengeResponses: {
          USERNAME: "ana@example.com",
          EMAIL_OTP_CODE: "12345678",
        },
      },
    },
  ]);
  expect(stored.get("circles.session")).toBe("refresh");
});

test("an unknown email signs up with no password, and the emailed code confirms and signs in", async () => {
  const calls = fakeCognito({
    InitiateAuth: (body) =>
      body.Session ? tokens() : fault("UserNotFoundException"),
    SignUp: () => Response.json({ Session: "signed-up" }),
    ConfirmSignUp: () => Response.json({ Session: "confirmed" }),
  });
  const session = await load();
  const step = await session.sendCode("new@example.com");
  expect(step).toEqual({
    email: "new@example.com",
    confirmsSignUp: true,
    session: "signed-up",
  });
  expect(await session.enterCode(step, "123456")).toBeUndefined();
  expect(await session.accessToken()).toBe("access");
  expect(calls.slice(1)).toEqual([
    {
      action: "SignUp",
      body: {
        ClientId: "client",
        Username: "new@example.com",
        UserAttributes: [{ Name: "email", Value: "new@example.com" }],
      },
    },
    {
      action: "ConfirmSignUp",
      body: {
        ClientId: "client",
        Username: "new@example.com",
        ConfirmationCode: "123456",
        Session: "signed-up",
      },
    },
    {
      action: "InitiateAuth",
      body: {
        ClientId: "client",
        AuthFlow: "USER_AUTH",
        AuthParameters: { USERNAME: "new@example.com" },
        Session: "confirmed",
      },
    },
  ]);
  expect(stored.get("circles.session")).toBe("refresh");
});

test("other sign-in failures don't sign up", async () => {
  const calls = fakeCognito({
    InitiateAuth: () => fault("LimitExceededException"),
  });
  const session = await load();
  await expect(session.sendCode("ana@example.com")).rejects.toMatchObject({
    type: "LimitExceededException",
  });
  expect(calls.map((call) => call.action)).toEqual(["InitiateAuth"]);
});

test("an account that never confirmed its email gets a new confirmation code, then a sign-in code", async () => {
  let confirmed = false;
  const calls = fakeCognito({
    InitiateAuth: () =>
      confirmed ? challenge() : fault("UserNotConfirmedException"),
    ResendConfirmationCode: () => Response.json({}),
    ConfirmSignUp: () => {
      confirmed = true;
      return Response.json({});
    },
  });
  const session = await load();
  const step = await session.sendCode("ana@example.com");
  expect(step).toEqual({ email: "ana@example.com", confirmsSignUp: true });
  expect(calls.at(-1)).toEqual({
    action: "ResendConfirmationCode",
    body: { ClientId: "client", Username: "ana@example.com" },
  });
  expect(await session.enterCode(step, "123456")).toMatchObject({
    confirmsSignUp: false,
    session: "otp",
  });
  expect(await session.accessToken()).toBeNull();
});

test("a sign-up confirmed after its session ran out asks for a sign-in code", async () => {
  fakeCognito({
    ConfirmSignUp: () => Response.json({ Session: "confirmed" }),
    InitiateAuth: (body) =>
      body.Session ? fault("NotAuthorizedException") : challenge(),
  });
  const session = await load();
  const step = {
    email: "new@example.com",
    confirmsSignUp: true,
    session: "old",
  };
  expect(await session.enterCode(step, "123456")).toMatchObject({
    confirmsSignUp: false,
    session: "otp",
  });
});

test.each([false, true])(
  "a wrong code is an error and doesn't sign in (confirming sign-up: %s)",
  async (confirmsSignUp) => {
    fakeCognito({
      RespondToAuthChallenge: () => fault("CodeMismatchException"),
      ConfirmSignUp: () => fault("CodeMismatchException"),
    });
    const session = await load();
    const step = { email: "ana@example.com", confirmsSignUp, session: "otp" };
    await expect(session.enterCode(step, "1")).rejects.toMatchObject({
      type: "CodeMismatchException",
    });
    expect(await session.accessToken()).toBeNull();
  },
);

test.each<[string, Handlers]>([
  ["a known email", { InitiateAuth: challenge }],
  [
    "a new email",
    {
      InitiateAuth: () => fault("UserNotFoundException"),
      SignUp: () => Response.json({}),
    },
  ],
  [
    "an unconfirmed email",
    {
      InitiateAuth: () => fault("UserNotConfirmedException"),
      ResendConfirmationCode: () => Response.json({}),
    },
  ],
])(
  "a code for %s can be sent again only after the cooldown",
  async (_, handlers) => {
    vi.useFakeTimers();
    fakeCognito(handlers);
    const session = await load();
    const cooldownMs = session.RESEND_COOLDOWN_SECONDS * 1000;
    expect(session.resendWaitSeconds()).toBe(0);

    await session.sendCode("ana@example.com");
    expect(session.resendWaitSeconds()).toBe(session.RESEND_COOLDOWN_SECONDS);
    vi.advanceTimersByTime(cooldownMs - 1500);
    expect(session.resendWaitSeconds()).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(session.resendWaitSeconds()).toBe(1);
    vi.advanceTimersByTime(500);
    expect(session.resendWaitSeconds()).toBe(0);

    await session.sendCode("ana@example.com");
    expect(session.resendWaitSeconds()).toBe(session.RESEND_COOLDOWN_SECONDS);
  },
);

test("a send that fails doesn't start the cooldown", async () => {
  vi.useFakeTimers();
  fakeCognito({ InitiateAuth: () => fault("LimitExceededException") });
  const session = await load();
  await expect(session.sendCode("ana@example.com")).rejects.toThrow();
  expect(session.resendWaitSeconds()).toBe(0);
});

test("an access token near expiry is refreshed once for concurrent requests", async () => {
  const calls = fakeCognito({
    RespondToAuthChallenge: () => tokens(30),
    InitiateAuth: () => tokens(3600, "fresh"),
  });
  const session = await load();
  await session.enterCode(
    { email: "ana@example.com", confirmsSignUp: false, session: "otp" },
    "1",
  );
  expect(
    await Promise.all([session.accessToken(), session.accessToken()]),
  ).toEqual(["fresh", "fresh"]);
  expect(calls.slice(1)).toEqual([
    {
      action: "InitiateAuth",
      body: {
        ClientId: "client",
        AuthFlow: "REFRESH_TOKEN_AUTH",
        AuthParameters: { REFRESH_TOKEN: "refresh" },
      },
    },
  ]);
  expect(stored.get("circles.session")).toBe("refresh");
});

test("a refused refresh token signs out, an unreachable Cognito doesn't", async () => {
  stored.set("circles.session", "refresh");
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));
  let session = await load();
  await expect(session.accessToken()).rejects.toThrow("offline");
  expect(stored.get("circles.session")).toBe("refresh");

  fakeCognito({ InitiateAuth: () => fault("NotAuthorizedException") });
  session = await load();
  await expect(session.accessToken()).rejects.toMatchObject({
    type: "NotAuthorizedException",
  });
  expect(await session.accessToken()).toBeNull();
});

test("signing out revokes the refresh token", async () => {
  stored.set("circles.session", "refresh");
  const calls = fakeCognito({ RevokeToken: () => Response.json({}) });
  const session = await load();
  session.signOut();
  expect(await session.accessToken()).toBeNull();
  expect(calls).toEqual([
    {
      action: "RevokeToken",
      body: { ClientId: "client", Token: "refresh" },
    },
  ]);
});

test("without a client ID the saved dev token is the access token", async () => {
  vi.stubEnv("EXPO_PUBLIC_COGNITO_CLIENT_ID", "");
  const session = await load();
  session.signInAsDev("ana@example.com");
  expect(await session.accessToken()).toBe("dev:ana@example.com");
});
