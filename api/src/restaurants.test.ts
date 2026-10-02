import { FakeRestaurantClient, GoogleRestaurantClient } from "@circles/ai";
import { describe, expect, test } from "vitest";
import { createRestaurantClient } from "./restaurants.ts";

describe("createRestaurantClient", () => {
  test("uses the fake when no key is set", () => {
    expect(createRestaurantClient({}).client).toBeInstanceOf(
      FakeRestaurantClient,
    );
  });
  test("uses Google when a key is set", () => {
    const { client, description } = createRestaurantClient({
      GOOGLE_PLACES_API_KEY: "k",
    });
    expect(client).toBeInstanceOf(GoogleRestaurantClient);
    expect(description).toContain("limit 30");
  });
  test("honours GOOGLE_PLACES_MAX_REQUESTS and rejects a bad value", () => {
    const env = { GOOGLE_PLACES_API_KEY: "k", GOOGLE_PLACES_MAX_REQUESTS: "5" };
    expect(createRestaurantClient(env).description).toContain("limit 5");
    expect(() =>
      createRestaurantClient({ ...env, GOOGLE_PLACES_MAX_REQUESTS: "lots" }),
    ).toThrow();
  });
});
