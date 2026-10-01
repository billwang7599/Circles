export interface Candidate {
  id: string;
  name: string;
  priceLevel?: number;
  rating?: number;
  location: LatLng;
  cuisines?: string[];
  /** Open periods in the place's local time. Missing means unknown. */
  openingHours?: OpeningPeriod[];
  /** Largest party the place can seat. Missing means unknown (Places has no capacity field). */
  maxPartySize?: number;
  source: string;
}

/** Minutes from Sunday 00:00 local time. A period crossing the week end has close > 10080. */
export interface OpeningPeriod {
  openMin: number;
  closeMin: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}
