// Compute fighter profile completeness.
// Approved baseline: 50%. +15 photo, +15 injury info filled, +20 one+ fight history entry.
export type CompletenessInput = {
  approved: boolean;
  hasPortrait: boolean;
  injuryAnswered: boolean;
  hasFightHistoryEntry: boolean;
};

export function completenessScore(i: CompletenessInput): number {
  if (!i.approved) return 0;
  let score = 50;
  if (i.hasPortrait) score += 15;
  if (i.injuryAnswered) score += 15;
  if (i.hasFightHistoryEntry) score += 20;
  return Math.min(score, 100);
}

export function completenessSteps(i: CompletenessInput): {
  label: string;
  done: boolean;
}[] {
  return [
    { label: "Application approved", done: i.approved },
    { label: "Profile photo added", done: i.hasPortrait },
    { label: "Injury information filled", done: i.injuryAnswered },
    { label: "At least one fight history entry", done: i.hasFightHistoryEntry },
  ];
}
