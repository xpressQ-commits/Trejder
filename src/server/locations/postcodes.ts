import { z } from "zod";
import { AccessError } from "@/server/security";

const responseSchema = z.object({
  "post code": z.string(),
  places: z.array(
    z.object({
      "place name": z.string().min(1).max(120),
      state: z.string().min(1).max(120),
    }),
  ),
});

export type PostcodeSuggestion = {
  postalCode: string;
  locality: string;
  county: string;
};

const countyNames = new Map(
  Object.entries({
    Blekinge: "Blekinge län",
    Dalarna: "Dalarnas län",
    Gotland: "Gotlands län",
    Gävleborg: "Gävleborgs län",
    Halland: "Hallands län",
    Jämtland: "Jämtlands län",
    Jönköping: "Jönköpings län",
    Kalmar: "Kalmar län",
    Kronoberg: "Kronobergs län",
    Norrbotten: "Norrbottens län",
    Skåne: "Skåne län",
    Stockholm: "Stockholms län",
    Södermanland: "Södermanlands län",
    Uppsala: "Uppsala län",
    Värmland: "Värmlands län",
    Västerbotten: "Västerbottens län",
    Västernorrland: "Västernorrlands län",
    Västmanland: "Västmanlands län",
    "Västra Götaland": "Västra Götalands län",
    Örebro: "Örebro län",
    Östergötland: "Östergötlands län",
  }).map(([name, county]) => [name.toLocaleLowerCase("sv-SE"), county]),
);

export function normalizeSwedishCounty(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (/ län$/i.test(trimmed)) return trimmed;
  return countyNames.get(trimmed.toLocaleLowerCase("sv-SE")) ?? `${trimmed} län`;
}

export async function lookupSwedishPostcode(
  input: string,
): Promise<PostcodeSuggestion[]> {
  const postalCode = input.replace(/\s+/g, "");
  if (!/^[1-9][0-9]{4}$/.test(postalCode)) {
    throw new AccessError(400, "INVALID_POSTAL_CODE");
  }
  let response: Response;
  try {
    response = await fetch(`https://api.zippopotam.us/SE/${postalCode}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 86_400 },
    });
  } catch {
    throw new AccessError(503, "POSTCODE_LOOKUP_UNAVAILABLE");
  }
  if (response.status === 404) return [];
  if (!response.ok) throw new AccessError(503, "POSTCODE_LOOKUP_UNAVAILABLE");
  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) throw new AccessError(503, "POSTCODE_LOOKUP_UNAVAILABLE");
  const unique = new Map<string, PostcodeSuggestion>();
  for (const place of parsed.data.places) {
    const suggestion = {
      postalCode,
      locality: place["place name"].trim(),
      county: normalizeSwedishCounty(place.state),
    };
    unique.set(`${suggestion.locality}\0${suggestion.county}`, suggestion);
  }
  return [...unique.values()];
}
