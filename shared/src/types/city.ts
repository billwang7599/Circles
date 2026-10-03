import { z } from "zod";
import { isValidTimeZone } from "../time.ts";
import type { LatLng } from "./place.ts";

/**
 * Where a person is. For now they pick a city; later this comes from their live position
 * (lat and lng from the device, timezone looked up from them).
 */
export const LocationSchema = z.object({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** IANA zone. Opening hours and free time are read in this zone. */
  timezone: z.string().refine(isValidTimeZone, "must be a valid IANA timezone"),
});
export type Location = z.infer<typeof LocationSchema>;

export interface City {
  id: string;
  name: string;
  /** IANA zone. Opening hours and "Saturday evening" are read in this zone. */
  timezone: string;
  center: LatLng;
}

export const CITIES: City[] = [
  {
    id: "toronto",
    name: "Toronto",
    timezone: "America/Toronto",
    center: { lat: 43.6532, lng: -79.3832 },
  },
  {
    id: "vancouver",
    name: "Vancouver",
    timezone: "America/Vancouver",
    center: { lat: 49.2827, lng: -123.1207 },
  },
  {
    id: "new-york",
    name: "New York",
    timezone: "America/New_York",
    center: { lat: 40.7128, lng: -74.006 },
  },
  {
    id: "san-francisco",
    name: "San Francisco",
    timezone: "America/Los_Angeles",
    center: { lat: 37.7749, lng: -122.4194 },
  },
  {
    id: "london",
    name: "London",
    timezone: "Europe/London",
    center: { lat: 51.5074, lng: -0.1278 },
  },
];

export const cityLocation = (city: City): Location => ({
  name: city.name,
  lat: city.center.lat,
  lng: city.center.lng,
  timezone: city.timezone,
});

export function findCity(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}
