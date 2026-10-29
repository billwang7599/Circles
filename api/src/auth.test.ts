import type { Me } from "@circles/shared";
import { afterEach, expect, test, vi } from "vitest";
import { devVerifier, verifierFor, type Verifier } from "./auth.ts";
import { testApp } from "./testApp.ts";

const cognito = {
  NODE_ENV: "production",
  COGNITO_USER_POOL_ID: "ca-central-1_Example",
  COGNITO_CLIENT_ID: "client",
  COGNITO_DOMAIN: "circles.auth.ca-central-1.amazoncognito.com",
};

afterEach(() => vi.unstubAllGlobals());

test("health needs no sign-in", async () => {
  const { call } = await testApp();
  expect((await call("GET", "/api/health")).status).toBe(200);
});

test.each([undefined, "garbage", "dev:not-an-email"])(
  "token %s is 401",
  async (token) => {
    const { call } = await testApp();
    const res = await call("GET", "/api/me", token);
    expect(res.status).toBe(401);
  },
);

test("the first request creates the account from the verified subject; later ones reuse it", async () => {
  const email = vi.fn(devVerifier.email);
  const { call, db } = await testApp({
    verifier: { ...devVerifier, email },
  });
  const token = "dev:ana@example.com";
  for (let i = 0; i < 2; i++) {
    const res = await call("GET", "/api/me", token);
    expect(res.status).toBe(200);
    expect(((await res.json()) as Me).email).toBe("ana@example.com");
  }
  expect(email).toHaveBeenCalledTimes(1);
  expect(await db.query("select sub, email from accounts")).toEqual([
    { sub: token, email: "ana@example.com" },
  ]);
});

test("a verifier that fails, rather than refusing the token, is a 500 and not a sign-out", async () => {
  const verifier: Verifier = {
    sub: () => Promise.reject(new Error("keys unreachable")),
    email: devVerifier.email,
  };
  const { call } = await testApp({ verifier });
  const res = await call("GET", "/api/me", "dev:ana@example.com");
  expect(res.status).toBe(500);
});

test("without Cognito settings, development uses dev tokens and production refuses to start", () => {
  const none = {
    ...cognito,
    COGNITO_USER_POOL_ID: "",
    COGNITO_CLIENT_ID: "",
    COGNITO_DOMAIN: "",
  };
  expect(verifierFor({ ...none, NODE_ENV: "development" })).toBe(devVerifier);
  expect(() => verifierFor(none)).toThrow(/COGNITO_USER_POOL_ID/);
  expect(() =>
    verifierFor({ ...cognito, NODE_ENV: "development", COGNITO_DOMAIN: "" }),
  ).toThrow(/COGNITO_DOMAIN/);
  expect(verifierFor(cognito)).not.toBe(devVerifier);
});

test("the Cognito verifier refuses tokens it didn't issue", async () => {
  const verifier = verifierFor(cognito);
  const encode = (part: object) =>
    Buffer.from(JSON.stringify(part)).toString("base64url");
  const foreign = [
    encode({ alg: "RS256", kid: "k" }),
    encode({ iss: "https://example.com", sub: "x", token_use: "access" }),
    "c2ln",
  ].join(".");
  expect(await verifier.sub("garbage")).toBeUndefined();
  expect(await verifier.sub("dev:ana@example.com")).toBeUndefined();
  expect(await verifier.sub(foreign)).toBeUndefined();
});

test("the Cognito verifier reads the email from the userInfo endpoint", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ sub: "s", email: "ana@example.com" }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await verifierFor(cognito).email("access")).toBe("ana@example.com");
  expect(fetch).toHaveBeenCalledWith(
    `https://${cognito.COGNITO_DOMAIN}/oauth2/userInfo`,
    { headers: { authorization: "Bearer access" } },
  );
});
