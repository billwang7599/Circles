import type { Candidate, LatLng } from "@circles/shared";

export interface RestaurantQuery {
  center: LatLng;
  radiusKm: number;
  cuisine?: string;
}

export interface RestaurantClient {
  search(query: RestaurantQuery): Promise<Candidate[]>;
}
