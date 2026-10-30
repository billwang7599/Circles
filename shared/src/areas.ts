import { z } from "zod";

export const AreaId = z.enum([
  "uw",
  "laurier",
  "uptown",
  "kitchener",
  "belmont",
  "galt",
]);
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
    id: "laurier",
    name: "Wilfrid Laurier University",
    lat: 43.4738,
    lng: -80.5275,
    radiusKm: 2,
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
  {
    id: "belmont",
    name: "Belmont Village",
    lat: 43.4389,
    lng: -80.5056,
    radiusKm: 2,
    timezone: "America/Toronto",
  },
  {
    id: "galt",
    name: "Downtown Cambridge",
    lat: 43.3601,
    lng: -80.3127,
    radiusKm: 4,
    timezone: "America/Toronto",
  },
];

export function areaById(id: string): Area {
  const area = AREAS.find((a) => a.id === id);
  if (!area) throw new Error(`Unknown area ${id}`);
  return area;
}
