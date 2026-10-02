import type { Candidate, LatLng, OpeningPeriod } from "@circles/shared";
import { WEEK_MIN } from "@circles/shared";

export interface RestaurantQuery {
  center: LatLng;
  radiusKm: number;
  cuisine?: string;
}

export interface RestaurantClient {
  search(query: RestaurantQuery): Promise<Candidate[]>;
}

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Price, rating and opening hours are Enterprise-tier fields, so every search bills at
// that tier. Request only what we use; extra fields (reviews, photos) cost more.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.priceLevel",
  "places.rating",
  "places.regularOpeningHours",
  "places.types",
].join(",");

/** locationBias circles are capped at 50 km. */
const MAX_RADIUS_M = 50_000;

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePoint {
  day: number;
  hour: number;
  minute: number;
}

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  priceLevel?: string;
  rating?: number;
  regularOpeningHours?: {
    periods?: { open: GooglePoint; close?: GooglePoint }[];
  };
  types?: string[];
}

const weekMin = (p: GooglePoint) => p.day * 1440 + p.hour * 60 + p.minute;

function toOpeningHours(place: GooglePlace): OpeningPeriod[] | undefined {
  const periods = place.regularOpeningHours?.periods;
  if (!periods) return undefined; // unknown, not "closed"
  return periods.map(({ open, close }) => {
    const openMin = weekMin(open);
    // Google omits close for places open 24/7.
    if (!close) return { openMin: 0, closeMin: 2 * WEEK_MIN };
    const closeMin = weekMin(close);
    return {
      openMin,
      closeMin: closeMin <= openMin ? closeMin + WEEK_MIN : closeMin,
    };
  });
}

function toCandidate(place: GooglePlace): Candidate | undefined {
  if (!place.id || !place.displayName || !place.location) return undefined;
  const cuisines = (place.types ?? [])
    .filter((t) => t.endsWith("_restaurant") && t !== "fast_food_restaurant")
    .map((t) => t.replace(/_restaurant$/, ""));
  const priceLevel = place.priceLevel
    ? PRICE_LEVELS[place.priceLevel]
    : undefined;
  const openingHours = toOpeningHours(place);
  return {
    id: place.id,
    name: place.displayName.text,
    location: { lat: place.location.latitude, lng: place.location.longitude },
    ...(priceLevel !== undefined ? { priceLevel } : {}),
    ...(place.rating !== undefined ? { rating: place.rating } : {}),
    ...(cuisines.length > 0 ? { cuisines } : {}),
    ...(openingHours ? { openingHours } : {}),
    source: "google",
  };
}

/** The request budget is spent. Raise maxRequests or restart to continue. */
export class RequestLimitError extends Error {}

export interface GoogleRestaurantClientOptions {
  apiKey: string;
  /** Hard cap on live requests for this process. Cache hits do not count. Default 30. */
  maxRequests?: number;
  /** How long a result is reused, to protect quota. Default 5 minutes. */
  cacheTtlMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * RestaurantClient backed by Google Places API (New) Text Search. Results are cached
 * only briefly and in memory; Google restricts storing places data, so there is no
 * persistent store.
 */
export class GoogleRestaurantClient implements RestaurantClient {
  private requests = 0;
  private readonly cache = new Map<
    string,
    { at: number; found: Candidate[] }
  >();
  private readonly maxRequests: number;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: GoogleRestaurantClientOptions) {
    this.maxRequests = options.maxRequests ?? 30;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60_000;
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  /** Live requests made so far by this client. */
  get requestCount() {
    return this.requests;
  }

  async search(q: RestaurantQuery): Promise<Candidate[]> {
    const key = JSON.stringify(q);
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < this.cacheTtlMs) return hit.found;

    if (this.requests >= this.maxRequests) {
      throw new RequestLimitError(
        `Google Places request limit reached (${this.maxRequests})`,
      );
    }
    this.requests++;

    const res = await this.fetchImpl(SEARCH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.options.apiKey,
        "x-goog-fieldmask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: q.cuisine ? `${q.cuisine} restaurant` : "restaurant",
        includedType: "restaurant",
        pageSize: 20,
        locationBias: {
          circle: {
            center: { latitude: q.center.lat, longitude: q.center.lng },
            radius: Math.min(q.radiusKm * 1000, MAX_RADIUS_M),
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Google Places request failed (${res.status}): ${await res.text()}`,
      );
    }
    const body = (await res.json()) as { places?: GooglePlace[] };
    const found = (body.places ?? []).flatMap((p) => toCandidate(p) ?? []);
    this.cache.set(key, { at: this.now(), found });
    return found;
  }
}
