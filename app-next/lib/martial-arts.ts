// Martial arts + class tiers taxonomy.
//
// Each martial art has its own class system. Keep this file as the single
// source of truth — form, zod schema, and admin render all import from here.

export const MARTIAL_ARTS = [
  { id: "kickboxing", name: "Kickboxing" },
  { id: "muay-thai",  name: "Muay Thai" },
  { id: "boxing",     name: "Boxing" },
  { id: "mma",        name: "MMA" },
] as const;

export type MartialArtId = (typeof MARTIAL_ARTS)[number]["id"];

const KICKBOXING_CLASSES = [
  { id: "J", name: "J-Class (Under 18)" },
  { id: "N", name: "N-Class (≤5 fights)" },
  { id: "L", name: "L-Class (Learning class)" },
  { id: "C", name: "C-Class (No shin pads)" },
  { id: "B", name: "B-Class (Debut pro)" },
  { id: "A", name: "A-Class (Seasoned pro)" },
] as const;

const BOXING_MMA_CLASSES = [
  { id: "amateur",      name: "Amateur" },
  { id: "novice",       name: "Novice" },
  { id: "intermediate", name: "Intermediate" },
  { id: "elite",        name: "Elite" },
  { id: "open",         name: "Open" },
  { id: "pro",          name: "Pro" },
] as const;

// Return the class options for a given martial art.
export function classesForMartialArt(
  art: MartialArtId | string | undefined | null,
): readonly { id: string; name: string }[] {
  switch (art) {
    case "kickboxing": return KICKBOXING_CLASSES;
    case "muay-thai":  return KICKBOXING_CLASSES;
    case "boxing":     return BOXING_MMA_CLASSES;
    case "mma":        return BOXING_MMA_CLASSES;
    default:           return [];
  }
}

export function martialArtRequiresClass(art: string | undefined | null): boolean {
  return classesForMartialArt(art).length > 0;
}

export function martialArtName(id: string | undefined | null): string {
  if (!id) return "";
  const found = MARTIAL_ARTS.find((m) => m.id === id);
  return found ? found.name : id;
}

export function classDisplayName(
  art: string | undefined | null,
  classId: string | undefined | null,
): string {
  if (!classId) return "";
  const options = classesForMartialArt(art);
  const found = options.find((c) => c.id === classId);
  return found ? found.name : classId;
}
