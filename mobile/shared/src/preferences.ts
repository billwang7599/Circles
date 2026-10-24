import { z } from "zod";

export const PreferenceId = z.enum([
  "sushi",
  "ramen",
  "korean",
  "indian",
  "middleEastern",
  "pizza",
  "vegetarian",
  "brunch",
  "coffee",
  "bubbleTea",
  "dessert",
  "bar",
]);
export type PreferenceId = z.infer<typeof PreferenceId>;

export type Preference = { id: PreferenceId; label: string; types: string[] };

export const PREFERENCES: readonly Preference[] = [
  {
    id: "sushi",
    label: "Sushi",
    types: ["sushi_restaurant", "japanese_restaurant"],
  },
  {
    id: "ramen",
    label: "Ramen",
    types: ["ramen_restaurant", "japanese_restaurant"],
  },
  { id: "korean", label: "Korean", types: ["korean_restaurant"] },
  { id: "indian", label: "Indian", types: ["indian_restaurant"] },
  {
    id: "middleEastern",
    label: "Middle Eastern",
    types: [
      "middle_eastern_restaurant",
      "lebanese_restaurant",
      "turkish_restaurant",
    ],
  },
  {
    id: "pizza",
    label: "Pizza",
    types: ["pizza_restaurant", "italian_restaurant"],
  },
  {
    id: "vegetarian",
    label: "Vegetarian",
    types: ["vegetarian_restaurant", "vegan_restaurant"],
  },
  {
    id: "brunch",
    label: "Brunch",
    types: ["brunch_restaurant", "breakfast_restaurant"],
  },
  { id: "coffee", label: "Coffee", types: ["cafe", "coffee_shop"] },
  { id: "bubbleTea", label: "Bubble tea", types: ["tea_house", "juice_shop"] },
  {
    id: "dessert",
    label: "Dessert",
    types: ["dessert_shop", "dessert_restaurant", "ice_cream_shop", "bakery"],
  },
  { id: "bar", label: "Bar", types: ["bar", "pub", "wine_bar"] },
];
