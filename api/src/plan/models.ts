import { bedrockDates, fakeDates, type DatesModel } from "./dates.ts";
import {
  bedrockItineraries,
  fakeItineraries,
  type ItineraryModel,
} from "./itinerary.ts";
import {
  fakePlaces,
  locationPlaces,
  type Places,
  type Position,
} from "./places.ts";
import { bedrockSetup, fakeSetup, type SetupModel } from "./setup.ts";

export type Models = {
  setup: SetupModel;
  dates: DatesModel;
  itineraries: ItineraryModel;
  // Not a model: the venue lookup the itineraries' days are checked against.
  places: Places;
};

// Map lookups one process may make: 300 unless set to a whole number above
// zero. Blank means the default, as every optional setting does.
export function placesCap(text = ""): number {
  if (text === "") return 300;
  const n = Number(text);
  if (!Number.isInteger(n) || n <= 0)
    throw new Error(
      `PLACES_MAX_REQUESTS must be a whole number above zero, not "${text}"`,
    );
  return n;
}

// Where the group usually is, for the venue lookup to lean towards:
// "longitude,latitude", Toronto unless set.
export function placesBias(text = ""): Position {
  if (text === "") return [-79.38, 43.65];
  const parts = text.split(",").map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n)))
    throw new Error(`PLACES_BIAS must be longitude,latitude, not "${text}"`);
  return parts as Position;
}

// One model for every feature and the venue lookup, all on AWS through the
// default credential chain when a model is named (Bedrock for the models,
// Amazon Location for the venues); the fakes otherwise. The settings come
// in as the environment gives them, blank for the defaults.
export function modelsFor(env: {
  AWS_REGION: string;
  BEDROCK_MODEL_ID: string;
  PLACES_MAX_REQUESTS?: string;
  PLACES_BIAS?: string;
}): Models {
  return env.BEDROCK_MODEL_ID
    ? {
        setup: bedrockSetup(env.AWS_REGION, env.BEDROCK_MODEL_ID),
        dates: bedrockDates(env.AWS_REGION, env.BEDROCK_MODEL_ID),
        itineraries: bedrockItineraries(env.AWS_REGION, env.BEDROCK_MODEL_ID),
        places: locationPlaces(
          env.AWS_REGION,
          placesCap(env.PLACES_MAX_REQUESTS),
          placesBias(env.PLACES_BIAS),
        ),
      }
    : {
        setup: fakeSetup(),
        dates: fakeDates(),
        itineraries: fakeItineraries(),
        places: fakePlaces(),
      };
}
