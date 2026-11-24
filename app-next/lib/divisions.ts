// Weight-division taxonomy (gender-aware).
//
// Single source of truth for the form, zod schema, admin edit UI, and
// display sites. Mirror the martial-arts.ts pattern.
//
// Division ids are gender-prefixed so the same physical weight can exist on
// both sides without colliding in the `Ranking` unique index. Examples:
//   "M-57kg"  — Men's 57 kg
//   "F-55kg"  — Women's 55 kg
//   "MMA-Featherweight" / "MMA-Lightweight" — legacy placeholders until the
//   federation ratifies MMA categories.

export type Gender = "male" | "female";

export const GENDERS: readonly { id: Gender; name: string }[] = [
  { id: "male", name: "Men's" },
  { id: "female", name: "Women's" },
] as const;

type DivisionOption = { id: string; name: string; kg: number | null };

const MENS_WEIGHTS: readonly { kg: number; name: string }[] = [
  { kg: 57, name: "Featherweight" },
  { kg: 60, name: "Lightweight" },
  { kg: 63, name: "Super Lightweight" },
  { kg: 67, name: "Welterweight" },
  { kg: 70, name: "Super Welterweight" },
  { kg: 72, name: "Light Middleweight" },
  { kg: 75, name: "Middleweight" },
  { kg: 80, name: "Light Cruiserweight" },
  { kg: 85, name: "Cruiserweight" },
];

const WOMENS_WEIGHTS: readonly { kg: number; name: string }[] = [
  { kg: 55, name: "Bantamweight" },
  { kg: 57, name: "Featherweight" },
  { kg: 60, name: "Lightweight" },
  { kg: 62, name: "Super Lightweight" },
];

const MENS_DIVISIONS: readonly DivisionOption[] = MENS_WEIGHTS.map((w) => ({
  id: `M-${w.kg}kg`,
  name: `Men's ${w.kg} kg (${w.name})`,
  kg: w.kg,
}));

const WOMENS_DIVISIONS: readonly DivisionOption[] = WOMENS_WEIGHTS.map((w) => ({
  id: `F-${w.kg}kg`,
  name: `Women's ${w.kg} kg (${w.name})`,
  kg: w.kg,
}));

// Legacy placeholders used for MMA until WUCO publishes those classes.
const LEGACY_DIVISIONS: readonly DivisionOption[] = [
  { id: "MMA-Featherweight", name: "Featherweight", kg: null },
  { id: "MMA-Lightweight", name: "Lightweight", kg: null },
];

// Convenience: ordered list of every known division id, used by the admin
// rankings fallback and anywhere a flat list is needed.
export const ALL_DIVISIONS: readonly DivisionOption[] = [
  ...MENS_DIVISIONS,
  ...WOMENS_DIVISIONS,
  ...LEGACY_DIVISIONS,
];

export function divisionsFor(
  gender: string | undefined | null,
  martialArt: string | undefined | null,
): readonly DivisionOption[] {
  // MMA still uses the legacy placeholders — gender irrelevant.
  if (martialArt === "mma") return LEGACY_DIVISIONS;
  if (gender === "male") return MENS_DIVISIONS;
  if (gender === "female") return WOMENS_DIVISIONS;
  return [];
}

export function isValidDivision(
  gender: string | undefined | null,
  martialArt: string | undefined | null,
  divisionId: string | undefined | null,
): boolean {
  if (!divisionId) return false;
  return divisionsFor(gender, martialArt).some((d) => d.id === divisionId);
}

// Display name for a division id. If gender is known, prefer the gendered
// lookup; otherwise fall back to a search across every list so legacy data
// still renders. Returns the raw id if nothing matches.
export function divisionDisplayName(
  gender: string | undefined | null,
  divisionId: string | undefined | null,
): string {
  if (!divisionId) return "";
  if (gender) {
    const found = divisionsFor(gender, null).find((d) => d.id === divisionId);
    if (found) return found.name;
  }
  const found = ALL_DIVISIONS.find((d) => d.id === divisionId);
  return found ? found.name : divisionId;
}

// Compact label for cards and lists (e.g. "M · 57 kg" or just the weight name
// for legacy divisions).
export function divisionShortLabel(
  divisionId: string | undefined | null,
): string {
  if (!divisionId) return "";
  const found = ALL_DIVISIONS.find((d) => d.id === divisionId);
  if (!found) return divisionId;
  if (found.kg == null) return found.name;
  const prefix = divisionId.startsWith("F-") ? "W" : "M";
  return `${prefix} · ${found.kg} kg`;
}

export function genderName(gender: string | undefined | null): string {
  const g = GENDERS.find((x) => x.id === gender);
  return g ? g.name : "";
}
