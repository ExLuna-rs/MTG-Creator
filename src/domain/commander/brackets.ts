/**
 * Règles des brackets Commander qui dépendent du nombre de Game Changers.
 * Wizards les fait évoluer : elles sont réunies ici, datées, pour être mises
 * à jour en un seul endroit. La liste des Game Changers, elle, vient des
 * données Scryfall (`game_changer`), jamais d'une liste écrite à la main.
 */
export const BRACKET_RULES = {
  /** Date de la dernière mise à jour des règles par Wizards. */
  updatedAt: "2025-10-21",
  brackets: [
    { level: 1, maxGameChangers: 0 },
    { level: 2, maxGameChangers: 0 },
    { level: 3, maxGameChangers: 3 },
    { level: 4, maxGameChangers: null },
    { level: 5, maxGameChangers: null },
  ],
} as const;

export type BracketLevel = (typeof BRACKET_RULES.brackets)[number]["level"];

/**
 * Bracket le plus bas compatible avec ce nombre de Game Changers (les autres
 * critères des brackets arrivent avec l'estimation complète, en phase 5).
 */
export function minimumBracket(gameChangers: number): BracketLevel {
  const bracket = BRACKET_RULES.brackets.find(
    ({ maxGameChangers }) =>
      maxGameChangers === null || gameChangers <= maxGameChangers,
  );
  return bracket?.level ?? 5;
}
