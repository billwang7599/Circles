import { z } from "zod";

export const AreaId = z.enum(["uw", "uptown", "kitchener"]);
export type AreaId = z.infer<typeof AreaId>;

export type Area = {
  id: AreaId;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  timezone: string;
};

export const AREAS: readonly Area[] = [
  {
    id: "uw",
    name: "University of Waterloo",
    lat: 43.4723,
    lng: -80.5449,
    radiusKm: 3,
    timezone: "America/Toronto",
  },
  {
    id: "uptown",
    name: "Uptown Waterloo",
    lat: 43.4647,
    lng: -80.5223,
    radiusKm: 4,
    timezone: "America/Toronto",
  },
  {
    id: "kitchener",
    name: "Downtown Kitchener",
    lat: 43.4516,
    lng: -80.4925,
    radiusKm: 5,
    timezone: "America/Toronto",
  },
];

export function areaById(id: string): Area {
  const area = AREAS.find((a) => a.id === id);
  if (!area) throw new Error(`Unknown area ${id}`);
  return area;
}
