import type { Candidate, LatLng } from "@circles/shared";

export interface PlacesQuery {
  center: LatLng;
  radiusKm: number;
  cuisine?: string;
}

export interface PlacesClient {
  search(query: PlacesQuery): Promise<Candidate[]>;
}
