import {
  COMMANDER_DECK_SIZE,
  countCards,
  type DeckCard,
  type DeckCardData,
  playedCards,
} from "../deck/deck";
import { type BracketLevel, minimumBracket } from "./brackets";
import { canPair, pairingAbilities } from "./partners";
import { maxCopies } from "./singleton";

/** Carte citée par un problème de validation. */
export interface IssueCard {
  oracleId: string;
  name: string;
}

/**
 * Problèmes relevés dans un deck Commander. Les erreurs rendent le deck
 * invalide ; les informations (Game Changers) ne font que renseigner.
 */
export type DeckIssue =
  | { code: "noCommander"; severity: "error" }
  | { code: "tooManyCommanders"; severity: "error"; count: number }
  | { code: "notACommander"; severity: "error"; cards: IssueCard[] }
  | { code: "invalidPair"; severity: "error"; cards: IssueCard[] }
  | { code: "deckSize"; severity: "error"; count: number; expected: number }
  | { code: "colorIdentity"; severity: "error"; cards: IssueCard[] }
  | {
      code: "tooManyCopies";
      severity: "error";
      cards: (IssueCard & { count: number; max: number })[];
    }
  | { code: "banned"; severity: "error"; cards: IssueCard[] }
  | { code: "notLegal"; severity: "error"; cards: IssueCard[] }
  | {
      code: "gameChangers";
      severity: "info";
      count: number;
      minimumBracket: BracketLevel;
      cards: IssueCard[];
    };

export type DeckIssueCode = DeckIssue["code"];

export interface DeckValidation {
  /** Aucune erreur : le deck respecte toutes les règles vérifiées. */
  valid: boolean;
  issues: DeckIssue[];
  /** Nombre de cartes, commandant(s) compris (sans les cartes à considérer). */
  size: number;
  /** Identité couleur des commandants (masque de bits WUBRG). */
  colorIdentity: number;
  gameChangers: number;
  minimumBracket: BracketLevel;
  /** Codes des erreurs qui concernent chaque carte, par `oracleId`. */
  cardIssues: Record<string, DeckIssueCode[]>;
}

const toIssueCard = ({ oracleId, name }: DeckCardData): IssueCard => ({
  oracleId,
  name,
});

/** Une carte peut-elle être commandant (seule ou avec un Background) ? */
function isEligibleCommander(card: DeckCardData): boolean {
  return card.canBeCommander || pairingAbilities(card).background;
}

function commanderIssues(commanders: DeckCardData[]): DeckIssue[] {
  if (commanders.length === 0) {
    return [{ code: "noCommander", severity: "error" }];
  }
  if (commanders.length > 2) {
    return [
      {
        code: "tooManyCommanders",
        severity: "error",
        count: commanders.length,
      },
    ];
  }
  if (commanders.length === 1) {
    return commanders[0].canBeCommander
      ? []
      : [
          {
            code: "notACommander",
            severity: "error",
            cards: [toIssueCard(commanders[0])],
          },
        ];
  }

  const ineligible = commanders.filter((card) => !isEligibleCommander(card));
  if (ineligible.length > 0) {
    return [
      {
        code: "notACommander",
        severity: "error",
        cards: ineligible.map(toIssueCard),
      },
    ];
  }
  const [first, second] = commanders;
  return canPair(first, second)
    ? []
    : [
        {
          code: "invalidPair",
          severity: "error",
          cards: commanders.map(toIssueCard),
        },
      ];
}

/** Regroupe les quantités par carte (une carte peut figurer dans deux zones). */
function totalsByCard(cards: DeckCard[]) {
  const totals = new Map<string, { card: DeckCardData; count: number }>();
  for (const entry of cards) {
    const total = totals.get(entry.oracleId);
    if (total) total.count += entry.quantity;
    else
      totals.set(entry.oracleId, { card: entry.card, count: entry.quantity });
  }
  return [...totals.values()];
}

/**
 * Vérifie un deck Commander : commandant(s) et paires, 100 cartes, identité
 * couleur, singleton, cartes bannies ou non légales, Game Changers. Les
 * cartes à considérer ne sont pas vérifiées.
 */
export function validateCommanderDeck(
  deck: readonly DeckCard[],
): DeckValidation {
  const played = playedCards(deck);
  const commanders = totalsByCard(
    played.filter((entry) => entry.zone === "commander"),
  ).map(({ card }) => card);
  const cards = totalsByCard(played);
  const size = countCards(played);
  const colorIdentity = commanders.reduce(
    (mask, card) => mask | card.colorIdentity,
    0,
  );

  const issues: DeckIssue[] = commanderIssues(commanders);

  if (size !== COMMANDER_DECK_SIZE) {
    issues.push({
      code: "deckSize",
      severity: "error",
      count: size,
      expected: COMMANDER_DECK_SIZE,
    });
  }

  // Sans commandant, l'identité couleur n'a pas de référence.
  const outsideIdentity =
    commanders.length > 0
      ? cards.filter(({ card }) => (card.colorIdentity & ~colorIdentity) !== 0)
      : [];
  if (outsideIdentity.length > 0) {
    issues.push({
      code: "colorIdentity",
      severity: "error",
      cards: outsideIdentity.map(({ card }) => toIssueCard(card)),
    });
  }

  const tooMany = cards
    .map(({ card, count }) => ({ card, count, max: maxCopies(card) }))
    .filter(({ count, max }) => count > max);
  if (tooMany.length > 0) {
    issues.push({
      code: "tooManyCopies",
      severity: "error",
      cards: tooMany.map(({ card, count, max }) => ({
        ...toIssueCard(card),
        count,
        max,
      })),
    });
  }

  const banned = cards.filter(
    ({ card }) => card.commanderLegality === "banned",
  );
  if (banned.length > 0) {
    issues.push({
      code: "banned",
      severity: "error",
      cards: banned.map(({ card }) => toIssueCard(card)),
    });
  }
  const notLegal = cards.filter(
    ({ card }) =>
      card.commanderLegality !== "legal" && card.commanderLegality !== "banned",
  );
  if (notLegal.length > 0) {
    issues.push({
      code: "notLegal",
      severity: "error",
      cards: notLegal.map(({ card }) => toIssueCard(card)),
    });
  }

  const gameChangerCards = cards.filter(({ card }) => card.gameChanger);
  const gameChangers = gameChangerCards.reduce(
    (total, { count }) => total + count,
    0,
  );
  const bracket = minimumBracket(gameChangers);
  if (gameChangers > 0) {
    issues.push({
      code: "gameChangers",
      severity: "info",
      count: gameChangers,
      minimumBracket: bracket,
      cards: gameChangerCards.map(({ card }) => toIssueCard(card)),
    });
  }

  const cardIssues: Record<string, DeckIssueCode[]> = {};
  for (const issue of issues) {
    if (issue.severity !== "error" || !("cards" in issue)) continue;
    for (const { oracleId } of issue.cards) {
      cardIssues[oracleId] = [...(cardIssues[oracleId] ?? []), issue.code];
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    size,
    colorIdentity,
    gameChangers,
    minimumBracket: bracket,
    cardIssues,
  };
}
