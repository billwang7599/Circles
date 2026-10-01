import { CITIES, findCity, type City } from "@circles/shared";
import { useEffect, useState } from "react";

const KEY = "circles.city";

function load(): City {
  try {
    return findCity(localStorage.getItem(KEY) ?? "") ?? CITIES[0]!;
  } catch {
    return CITIES[0]!; // storage blocked: fall back to the first city
  }
}

/** Selected city, mirrored to localStorage so it survives refreshes. */
export function useCity() {
  const [city, setCity] = useState<City>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, city.id);
    } catch {
      // storage unavailable: state still works for this session
    }
  }, [city]);

  return { city, setCityId: (id: string) => setCity(findCity(id) ?? city) };
}
