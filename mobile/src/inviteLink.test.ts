import type { ParsedURL } from "expo-linking";
import { expect, test } from "vitest";
import { inviteParams } from "./inviteLink";

// What Linking.parse makes of a URL in a built app: the hostname, the path
// without its leading slash, and the query as an object.
function parsed(url: string): ParsedURL {
  const { protocol, hostname, pathname, searchParams } = new URL(url);
  return {
    scheme: protocol.slice(0, -1),
    hostname: hostname || null,
    path: pathname.replace(/^\//, "") || null,
    queryParams: Object.fromEntries(searchParams),
  };
}

const host =
  "https://ci-889f2eab7cae4e068cc6b522abc6fa1c.ecs.ca-central-1.on.aws";

test("the Universal Link and the custom-scheme link name the same invite", () => {
  expect(inviteParams(parsed(`${host}/i/ski-trip?g=abc_-123`))).toEqual({
    slug: "ski-trip",
    g: "abc_-123",
  });
  expect(inviteParams(parsed(`${host}/i/ski-trip/?g=abc_-123`))).toEqual({
    slug: "ski-trip",
    g: "abc_-123",
  });
  expect(
    inviteParams(parsed("circles://invite?slug=ski-trip&g=abc_-123")),
  ).toEqual({ slug: "ski-trip", g: "abc_-123" });
  // Expo Go strips its own prefix and leaves the first segment as the path.
  expect(
    inviteParams({
      scheme: "exp",
      hostname: null,
      path: "invite",
      queryParams: { slug: "ski-trip", g: "abc_-123" },
    }),
  ).toEqual({ slug: "ski-trip", g: "abc_-123" });
});

test("a link missing its token still reaches the invite screen, which says so", () => {
  expect(inviteParams(parsed(`${host}/i/ski-trip`))).toEqual({
    slug: "ski-trip",
    g: undefined,
  });
  expect(inviteParams(parsed("circles://invite"))).toEqual({
    slug: undefined,
    g: undefined,
  });
});

test("other links are not invites", () => {
  for (const url of [
    `${host}/i/ski-trip/preview.png`,
    `${host}/i/`,
    `${host}/api/health`,
    "circles://sign-in",
    "circles://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081",
  ])
    expect(inviteParams(parsed(url)), url).toBeUndefined();
});
