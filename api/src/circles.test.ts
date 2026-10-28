import type { MembershipResponse } from "@circles/shared";
import { beforeAll, expect, test, vi } from "vitest";
import { createApp } from "./app.ts";
import { testDb } from "./testDb.ts";

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp(await testDb());
});

function get(path: string, token?: string) {
  return app.request(path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function post(path: string, data: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function createCircle(name: string, memberName: string) {
  const res = await post("/api/circles", { name, memberName });
  expect(res.status).toBe(201);
  return (await res.json()) as MembershipResponse & { token: string };
}

test("joining with a name someone in the circle already uses is 409", async () => {
  const { circle } = await createCircle("Dinner club", "Nicky");
  const res = await post("/api/circles/join", {
    code: circle.joinCode,
    name: "nicky",
  });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: "Someone in this circle already uses that name",
  });
});

test("no token is 401", async () => {
  const res = await get("/api/me");
  expect(res.status).toBe(401);
});

test("a token from another circle is 403 on the circle view", async () => {
  const mine = await createCircle("Mine", "Nicky");
  const theirs = await createCircle("Theirs", "Bill");
  const res = await get(`/api/circles/${mine.circle.id}`, theirs.token);
  expect(res.status).toBe(403);
});

test("the request log never contains the token", async () => {
  const write = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);
  const { token } = await createCircle("Logged", "Nicky");
  const res = await get("/api/me", token);
  const lines = write.mock.calls.map(([chunk]) => String(chunk));
  write.mockRestore();
  expect(res.status).toBe(200);
  expect(lines.some((line) => line.includes('"path":"/api/me"'))).toBe(true);
  expect(lines.some((line) => line.includes(token))).toBe(false);
});
