import type { Area } from "@circles/shared";
import { z } from "zod";

type OpeningPoint = { day: number; hour: number; minute: number };
export type OpeningPeriod = { open: OpeningPoint; close?: OpeningPoint };

export type FoundPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  priceLevel?: number;
  rating?: number;
  types: string[];
  mapsUrl: string;
  hours?: OpeningPeriod[];
};

export type PlacesClient = {
  search(query: string, area: Area): Promise<FoundPlace[]>;
};

export class PlacesUnavailable extends Error {}

const fieldMask = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.priceLevel",
  "places.rating",
  "places.regularOpeningHours",
  "places.types",
  "places.googleMapsUri",
].join(",");

const priceLevels = new Map([
  ["PRICE_LEVEL_FREE", 0],
  ["PRICE_LEVEL_INEXPENSIVE", 1],
  ["PRICE_LEVEL_MODERATE", 2],
  ["PRICE_LEVEL_EXPENSIVE", 3],
  ["PRICE_LEVEL_VERY_EXPENSIVE", 4],
]);

// Google's JSON leaves out zero-valued fields, so midnight is `{}`.
const Point = z.object({
  day: z.number().int().default(0),
  hour: z.number().int().default(0),
  minute: z.number().int().default(0),
});

const SearchResponse = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }),
        formattedAddress: z.string().default(""),
        location: z.object({ latitude: z.number(), longitude: z.number() }),
        priceLevel: z.string().optional(),
        rating: z.number().optional(),
        // A temporarily closed place has hours with no periods: closed for every slot.
        regularOpeningHours: z
          .object({
            periods: z
              .array(z.object({ open: Point, close: Point.optional() }))
              .default([]),
          })
          .optional(),
        types: z.array(z.string()).default([]),
        googleMapsUri: z.string().default(""),
      }),
    )
    .default([]),
});

export function googlePlaces(
  apiKey: string,
  maxRequestsPerDay: number,
): PlacesClient {
  let used = { day: "", count: 0 };
  return {
    async search(query, area) {
      const day = new Date().toISOString().slice(0, 10);
      if (used.day !== day) used = { day, count: 0 };
      if (used.count >= maxRequestsPerDay)
        throw new PlacesUnavailable("Daily request cap reached");
      used.count += 1;

      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey,
            "x-goog-fieldmask": fieldMask,
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: 20,
            locationBias: {
              circle: {
                center: { latitude: area.lat, longitude: area.lng },
                radius: Math.min(area.radiusKm, 50) * 1000,
              },
            },
          }),
        },
      ).catch((err: unknown) => {
        throw new PlacesUnavailable(String(err));
      });
      if (!response.ok)
        throw new PlacesUnavailable(`Places returned ${response.status}`);
      const parsed = SearchResponse.safeParse(
        await response.json().catch(() => undefined),
      );
      if (!parsed.success)
        throw new PlacesUnavailable("Places returned an unexpected body");

      return parsed.data.places.map((p) => ({
        id: p.id,
        name: p.displayName.text,
        address: p.formattedAddress,
        lat: p.location.latitude,
        lng: p.location.longitude,
        priceLevel:
          p.priceLevel === undefined
            ? undefined
            : priceLevels.get(p.priceLevel),
        rating: p.rating,
        types: p.types,
        mapsUrl: p.googleMapsUri,
        hours: p.regularOpeningHours?.periods,
      }));
    },
  };
}
