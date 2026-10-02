import {
  FakeRestaurantClient,
  GoogleRestaurantClient,
  type RestaurantClient,
} from "@circles/ai";

/**
 * Google Places when GOOGLE_PLACES_API_KEY is set, otherwise the fake so the app runs
 * with no key. GOOGLE_PLACES_MAX_REQUESTS caps live requests per process (default 30).
 */
export function createRestaurantClient(env: NodeJS.ProcessEnv = process.env): {
  client: RestaurantClient;
  description: string;
} {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      client: new FakeRestaurantClient(),
      description: "fake restaurants (no GOOGLE_PLACES_API_KEY)",
    };
  }
  const max = env.GOOGLE_PLACES_MAX_REQUESTS
    ? Number(env.GOOGLE_PLACES_MAX_REQUESTS)
    : undefined;
  if (max !== undefined && !(Number.isInteger(max) && max >= 0)) {
    throw new Error(
      "GOOGLE_PLACES_MAX_REQUESTS must be a non-negative integer",
    );
  }
  return {
    client: new GoogleRestaurantClient({
      apiKey,
      ...(max !== undefined ? { maxRequests: max } : {}),
    }),
    description: `Google Places (limit ${max ?? 30} requests per run)`,
  };
}
