import { wallClockAsUtc, type Area, type Interval } from "@circles/shared";
import type { FoundPlace, OpeningPeriod } from "./places.ts";

export type FilterReason = "over_budget" | "closed" | "too_far";
type Unverified = "budget" | "openHours";

export type Candidate = {
  place: FoundPlace;
  distanceKm: number;
  matchedPreferences: number;
  times: Interval[];
  unverified: Unverified[];
};

type Filtered = {
  candidates: Candidate[];
  rejected: Record<FilterReason, number>;
};

const keep = 12;
const minutesPerWeek = 7 * 24 * 60;

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function minuteOfWeek(iso: string, timezone: string): number {
  const local = new Date(wallClockAsUtc(new Date(iso), timezone));
  return (
    local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes()
  );
}

function openFor(
  hours: OpeningPeriod[],
  slot: Interval,
  timezone: string,
): boolean {
  const start = minuteOfWeek(slot.start, timezone);
  const length = (Date.parse(slot.end) - Date.parse(slot.start)) / 60000;
  return hours.some(({ open, close }) => {
    if (!close) return true;
    const opens = open.day * 1440 + open.hour * 60 + open.minute;
    let closes = close.day * 1440 + close.hour * 60 + close.minute;
    if (closes <= opens) closes += minutesPerWeek;
    return [start, start + minutesPerWeek].some(
      (s) => opens <= s && s + length <= closes,
    );
  });
}

export function filterPlaces(
  places: FoundPlace[],
  input: {
    priceCap: number;
    slots: Interval[];
    area: Area;
    preferenceTypes: string[];
  },
): Filtered {
  const rejected: Record<FilterReason, number> = {
    over_budget: 0,
    closed: 0,
    too_far: 0,
  };
  const wanted = new Set(input.preferenceTypes);
  const candidates: Candidate[] = [];

  for (const place of places) {
    const unverified: Unverified[] = [];
    if (place.priceLevel === undefined) unverified.push("budget");
    else if (place.priceLevel > input.priceCap) {
      rejected.over_budget += 1;
      continue;
    }

    let open = input.slots;
    if (place.hours === undefined) unverified.push("openHours");
    else {
      const hours = place.hours;
      open = input.slots.filter((slot) =>
        openFor(hours, slot, input.area.timezone),
      );
      if (open.length === 0) {
        rejected.closed += 1;
        continue;
      }
    }

    const distance = distanceKm(input.area, place);
    if (distance > input.area.radiusKm) {
      rejected.too_far += 1;
      continue;
    }

    candidates.push({
      place,
      distanceKm: Math.round(distance * 10) / 10,
      matchedPreferences: place.types.filter((t) => wanted.has(t)).length,
      times: spaced(open, input.area.timezone),
      unverified,
    });
  }

  candidates.sort(
    (a, b) =>
      b.matchedPreferences - a.matchedPreferences ||
      a.distanceKm - b.distanceKm ||
      (b.place.rating ?? 0) - (a.place.rating ?? 0),
  );
  return { candidates: candidates.slice(0, keep), rejected };
}

// Up to three non-overlapping slots, on different days where the window
// allows it, so a week-long plan offers more than its first day.
function spaced(slots: Interval[], timezone: string) {
  const dayOf = (slot: Interval) =>
    new Date(wallClockAsUtc(new Date(slot.start), timezone))
      .toISOString()
      .slice(0, 10);
  const picked: Interval[] = [];
  const fits = (slot: Interval) =>
    !picked.includes(slot) &&
    picked.every((p) => slot.start >= p.end || slot.end <= p.start);
  for (const slot of slots) {
    if (picked.length === 3) break;
    if (fits(slot) && !picked.some((p) => dayOf(p) === dayOf(slot)))
      picked.push(slot);
  }
  for (const slot of slots) {
    if (picked.length === 3) break;
    if (fits(slot)) picked.push(slot);
  }
  return picked.sort((a, b) => a.start.localeCompare(b.start));
}
