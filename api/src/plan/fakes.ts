import type { FoundPlace, OpeningPeriod, PlacesClient } from "./places.ts";
import type { Ranker } from "./rank.ts";

type Clock = [hour: number, minute: number];

function daily(
  open: Clock,
  close: Clock,
  days = [0, 1, 2, 3, 4, 5, 6],
): OpeningPeriod[] {
  return days.map((day) => ({
    open: { day, hour: open[0], minute: open[1] },
    close: {
      day: close[0] < open[0] ? (day + 1) % 7 : day,
      hour: close[0],
      minute: close[1],
    },
  }));
}

const mapsUrl = (name: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;

export const fakePlaceList: FoundPlace[] = [
  {
    id: "ChIJk7Fd2kT0K4gRwQ2mY8e3u1A",
    name: "Kinkaku Izakaya",
    address: "150 University Ave W, Waterloo, ON N2L 3E4",
    lat: 43.4727,
    lng: -80.5376,
    priceLevel: 2,
    rating: 4.3,
    types: ["japanese_restaurant", "ramen_restaurant", "restaurant"],
    mapsUrl: mapsUrl("Kinkaku Izakaya Waterloo"),
    hours: daily([11, 30], [22, 0]),
  },
  {
    id: "ChIJ0b3Xx0T0K4gRJ1pLq9cVt2Y",
    name: "Lazeez Shawarma",
    address: "160 University Ave W, Waterloo, ON N2L 3E9",
    lat: 43.4731,
    lng: -80.5364,
    priceLevel: 1,
    rating: 4.1,
    types: [
      "middle_eastern_restaurant",
      "lebanese_restaurant",
      "fast_food_restaurant",
    ],
    mapsUrl: mapsUrl("Lazeez Shawarma University Ave Waterloo"),
    hours: daily([11, 0], [2, 0]),
  },
  {
    id: "ChIJm5QzD0X0K4gRfT6nV2sKd4c",
    name: "Sweet Dreams Teashop",
    address: "150 University Ave W, Waterloo, ON N2L 3E4",
    lat: 43.4726,
    lng: -80.5372,
    rating: 4.4,
    types: ["tea_house", "cafe"],
    mapsUrl: mapsUrl("Sweet Dreams Teashop Waterloo"),
    hours: daily([12, 0], [23, 0]),
  },
  {
    id: "ChIJ9yHv7UT0K4gR3Nq2Lw8bR5E",
    name: "Gol's Lanzhou Noodle",
    address: "150 University Ave W, Waterloo, ON N2L 3E4",
    lat: 43.4728,
    lng: -80.538,
    priceLevel: 1,
    rating: 4.2,
    types: ["chinese_restaurant", "restaurant"],
    mapsUrl: mapsUrl("Gol's Lanzhou Noodle Waterloo"),
  },
  {
    id: "ChIJ2cVn8kb0K4gRhXk4Pz7Ru9U",
    name: "Seoul Soul",
    address: "33 University Ave E, Waterloo, ON N2J 2V9",
    lat: 43.4769,
    lng: -80.5222,
    priceLevel: 2,
    rating: 4.5,
    types: ["korean_restaurant", "restaurant"],
    mapsUrl: mapsUrl("Seoul Soul Waterloo"),
    hours: daily([11, 30], [21, 0]),
  },
  {
    id: "ChIJQ4u9eUr0K4gRb8Fz1Kp6tHo",
    name: "Ken Sushi House",
    address: "130 King St S, Waterloo, ON N2J 1P5",
    lat: 43.4635,
    lng: -80.523,
    priceLevel: 2,
    rating: 4.6,
    types: ["sushi_restaurant", "japanese_restaurant", "restaurant"],
    mapsUrl: mapsUrl("Ken Sushi House Waterloo"),
    hours: daily([11, 30], [21, 30], [0, 2, 3, 4, 5, 6]),
  },
  {
    id: "ChIJyWzR6Ur0K4gRdPq8Vb3Ln0M",
    name: "Ethel's Lounge",
    address: "114 King St N, Waterloo, ON N2J 2X6",
    lat: 43.4663,
    lng: -80.5213,
    priceLevel: 2,
    rating: 4.4,
    types: ["bar", "pub", "restaurant"],
    mapsUrl: mapsUrl("Ethel's Lounge Waterloo"),
    hours: daily([11, 0], [2, 0]),
  },
  {
    id: "ChIJ7sKp1Ur0K4gRnR5cQx2Fm8w",
    name: "Settlement Co.",
    address: "2 King St N, Waterloo, ON N2J 2W7",
    lat: 43.4651,
    lng: -80.5228,
    priceLevel: 1,
    rating: 4.5,
    types: ["coffee_shop", "cafe", "bakery"],
    mapsUrl: mapsUrl("Settlement Co. Waterloo"),
    hours: daily([7, 30], [19, 0]),
  },
  {
    id: "ChIJVzNf4kr0K4gRaL3wH7yJq2k",
    name: "Jane Bond",
    address: "5 Princess St W, Waterloo, ON N2L 2X7",
    lat: 43.4661,
    lng: -80.5238,
    priceLevel: 2,
    rating: 4.3,
    types: ["vegetarian_restaurant", "bar", "restaurant"],
    mapsUrl: mapsUrl("Jane Bond Waterloo"),
    hours: daily([17, 0], [0, 0]),
  },
  {
    id: "ChIJg2Tq5Er0K4gRtY9Dn6eWs3I",
    name: "Famoso Neapolitan Pizzeria",
    address: "7 Erb St W, Waterloo, ON N2L 1S8",
    lat: 43.4641,
    lng: -80.5265,
    priceLevel: 2,
    rating: 4.2,
    types: ["pizza_restaurant", "italian_restaurant", "restaurant"],
    mapsUrl: mapsUrl("Famoso Neapolitan Pizzeria Waterloo"),
    hours: daily([11, 30], [22, 0]),
  },
  {
    id: "ChIJd8Xw0Uj0K4gRq2Vb7Mz9Ke4",
    name: "The Yeti Cafe",
    address: "15 Ontario St N, Kitchener, ON N2H 4Y3",
    lat: 43.4512,
    lng: -80.4916,
    priceLevel: 2,
    rating: 4.6,
    types: ["brunch_restaurant", "breakfast_restaurant", "cafe"],
    mapsUrl: mapsUrl("The Yeti Cafe Kitchener"),
    hours: daily([8, 0], [15, 0]),
  },
  {
    id: "ChIJe5Lm3Uj0K4gRxU1Gh8rTp6Q",
    name: "Rich Uncle Tavern",
    address: "45 King St W, Kitchener, ON N2G 1A1",
    lat: 43.4512,
    lng: -80.4928,
    priceLevel: 3,
    rating: 4.4,
    types: ["bar", "restaurant"],
    mapsUrl: mapsUrl("Rich Uncle Tavern Kitchener"),
    hours: daily([16, 0], [0, 0]),
  },
];

export function fakePlaces(): PlacesClient {
  return { search: async () => fakePlaceList };
}

export function fakeRanker(): Ranker {
  return {
    model: "fake",
    async rank(input) {
      return {
        output: {
          picks: input.candidates.slice(0, 3).map((c) => ({
            candidateId: c.id,
            summary: `${c.name} is ${c.distanceKm} km away and matches ${c.matchedPreferences} of the group's preferences.`,
          })),
        },
        stopReason: "end_turn",
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}
