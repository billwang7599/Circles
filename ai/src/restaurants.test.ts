import { describe, expect, test } from "vitest";
import { GoogleRestaurantClient, RequestLimitError } from "./restaurants.ts";

const center = { lat: 43.65, lng: -79.38 };

const place = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  displayName: { text: "Noodle House" },
  location: { latitude: 43.66, longitude: -79.39 },
  priceLevel: "PRICE_LEVEL_MODERATE",
  rating: 4.4,
  types: ["ramen_restaurant", "restaurant", "food"],
  regularOpeningHours: {
    periods: [
      {
        open: { day: 6, hour: 11, minute: 30 },
        close: { day: 6, hour: 22, minute: 0 },
      },
    ],
  },
  ...over,
});

function mockFetch(places: unknown[], status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(
      status === 200 ? JSON.stringify({ places }) : "denied",
      { status },
    );
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const client = (f: typeof fetch, extra = {}) =>
  new GoogleRestaurantClient({ apiKey: "k", fetch: f, ...extra });

describe("GoogleRestaurantClient", () => {
  test("sends the key, a field mask, and a restaurant search biased to the area", async () => {
    const { fn, calls } = mockFetch([]);
    await client(fn).search({ center, radiusKm: 5, cuisine: "ramen" });
    const { url, init } = calls[0]!;
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("k");
    expect(headers["x-goog-fieldmask"]).toContain("places.priceLevel");
    expect(headers["x-goog-fieldmask"]).toContain("places.regularOpeningHours");
    expect(headers["x-goog-fieldmask"]).not.toContain("reviews");
    const body = JSON.parse(init.body as string);
    expect(body.textQuery).toBe("ramen restaurant");
    expect(body.includedType).toBe("restaurant");
    expect(body.locationBias.circle).toEqual({
      center: { latitude: 43.65, longitude: -79.38 },
      radius: 5000,
    });
  });

  test("caps the search radius at 50 km", async () => {
    const { fn, calls } = mockFetch([]);
    await client(fn).search({ center, radiusKm: 200 });
    expect(
      JSON.parse(calls[0]!.init.body as string).locationBias.circle.radius,
    ).toBe(50000);
  });

  test("maps a place to a Candidate", async () => {
    const { fn } = mockFetch([place()]);
    const [c] = await client(fn).search({ center, radiusKm: 5 });
    expect(c).toEqual({
      id: "g1",
      name: "Noodle House",
      location: { lat: 43.66, lng: -79.39 },
      priceLevel: 2,
      rating: 4.4,
      cuisines: ["ramen"],
      // Saturday 11:30-22:00 as minutes from Sunday 00:00
      openingHours: [
        { openMin: 6 * 1440 + 11 * 60 + 30, closeMin: 6 * 1440 + 22 * 60 },
      ],
      source: "google",
    });
  });

  test("a period closing after midnight wraps; one closing past Saturday wraps the week", async () => {
    const wrap = place({
      regularOpeningHours: {
        periods: [
          {
            open: { day: 6, hour: 18, minute: 0 },
            close: { day: 0, hour: 2, minute: 0 },
          },
        ],
      },
    });
    const { fn } = mockFetch([wrap]);
    const [c] = await client(fn).search({ center, radiusKm: 5 });
    expect(c!.openingHours).toEqual([
      { openMin: 6 * 1440 + 18 * 60, closeMin: 7 * 1440 + 2 * 60 },
    ]);
  });

  test("a place open 24/7 (no close) is open the whole week", async () => {
    const always = place({
      regularOpeningHours: {
        periods: [{ open: { day: 0, hour: 0, minute: 0 } }],
      },
    });
    const { fn } = mockFetch([always]);
    const [c] = await client(fn).search({ center, radiusKm: 5 });
    expect(c!.openingHours?.[0]?.openMin).toBe(0);
    expect(c!.openingHours?.[0]?.closeMin).toBeGreaterThanOrEqual(7 * 1440);
  });

  test("missing price, rating and hours stay unknown rather than defaulting", async () => {
    const bare = {
      id: "g2",
      displayName: { text: "Mystery" },
      location: { latitude: 1, longitude: 2 },
    };
    const { fn } = mockFetch([bare]);
    const [c] = await client(fn).search({ center, radiusKm: 5 });
    expect(c).toEqual({
      id: "g2",
      name: "Mystery",
      location: { lat: 1, lng: 2 },
      source: "google",
    });
  });

  test("skips places without an id, name or location", async () => {
    const { fn } = mockFetch([{ id: "x" }, place()]);
    expect(await client(fn).search({ center, radiusKm: 5 })).toHaveLength(1);
  });

  test("an error response throws with the status", async () => {
    const { fn } = mockFetch([], 403);
    await expect(client(fn).search({ center, radiusKm: 5 })).rejects.toThrow(
      "403",
    );
  });

  test("repeat searches within the TTL hit the cache and do not count", async () => {
    const { fn, calls } = mockFetch([place()]);
    let t = 0;
    const c = client(fn, { now: () => t, cacheTtlMs: 1000 });
    await c.search({ center, radiusKm: 5 });
    t = 500;
    await c.search({ center, radiusKm: 5 });
    expect(calls).toHaveLength(1);
    expect(c.requestCount).toBe(1);
    t = 2000;
    await c.search({ center, radiusKm: 5 });
    expect(calls).toHaveLength(2);
  });

  test("stops at the request limit instead of calling Google", async () => {
    const { fn, calls } = mockFetch([]);
    const c = client(fn, { maxRequests: 2 });
    await c.search({ center, radiusKm: 1 });
    await c.search({ center, radiusKm: 2 });
    await expect(c.search({ center, radiusKm: 3 })).rejects.toBeInstanceOf(
      RequestLimitError,
    );
    expect(calls).toHaveLength(2);
  });
});
