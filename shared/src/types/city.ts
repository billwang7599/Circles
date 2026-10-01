import type { LatLng } from "./place.js";

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

export function findCity(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}
