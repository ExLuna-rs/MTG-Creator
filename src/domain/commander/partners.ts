import { type DeckCardData, frontName } from "../deck/deck";

/**
 * Capacités qui permettent d'avoir deux commandants. Elles sont lues dans le
 * texte Oracle, chacune au début d'une ligne, suivie ou non d'un rappel entre
 * parenthèses : « Partner (You can have two commanders if both have partner.) ».
 */
export interface PairingAbilities {
  /** « Partner » seul : se combine avec toute autre carte « Partner ». */
  partner: boolean;
  /** « Partner—Survivors » et autres variantes : même variante requise. */
  partnerGroup: string | null;
  /** « Partner with Pir, Imaginative Rascal » : uniquement avec cette carte. */
  partnerWith: string | null;
  friendsForever: boolean;
  chooseABackground: boolean;
  /** Enchantement légendaire de sous-type Background. */
  background: boolean;
  doctorsCompanion: boolean;
  /** Créature légendaire « Time Lord Doctor », sans autre type de créature. */
  doctor: boolean;
}

type PairingCard = Pick<
  DeckCardData,
  "name" | "oracleText" | "typeLine" | "supertypes" | "types" | "subtypes"
>;

/** Fin d'une capacité : rappel entre parenthèses ou fin de ligne. */
const END = String.raw`\s*(?:\(|$)`;

function ability(text: string, pattern: string): RegExpMatchArray | null {
  return text.match(new RegExp(`^${pattern}${END}`, "im"));
}

export function pairingAbilities(card: PairingCard): PairingAbilities {
  const text = card.oracleText ?? "";
  const front = card.typeLine.split(" // ")[0];
  const legendary = card.supertypes.includes("Legendary");
  const partnerWith = ability(text, "Partner with ([^(\\n]+?)");
  const partnerGroup = ability(text, "Partner\\s*[—-]\\s*([^(\\n]+?)");

  return {
    partner: ability(text, "Partner") !== null,
    partnerGroup: partnerGroup?.[1].trim() ?? null,
    partnerWith: partnerWith?.[1].trim() ?? null,
    friendsForever: ability(text, "Friends forever") !== null,
    chooseABackground: ability(text, "Choose a Background") !== null,
    background:
      legendary &&
      card.types.includes("Enchantment") &&
      /—.*\bBackground\b/.test(front),
    doctorsCompanion: ability(text, "Doctor's companion") !== null,
    doctor:
      legendary &&
      card.types.includes("Creature") &&
      /—\s*Time Lord Doctor\s*$/.test(front),
  };
}

/** Indique si la carte peut former une paire de commandants avec une autre. */
export function hasPairingAbility(card: PairingCard): boolean {
  const abilities = pairingAbilities(card);
  return (
    abilities.partner ||
    abilities.partnerGroup !== null ||
    abilities.partnerWith !== null ||
    abilities.friendsForever ||
    abilities.chooseABackground ||
    abilities.background ||
    abilities.doctorsCompanion ||
    abilities.doctor
  );
}

/** Les deux cartes peuvent-elles être commandants ensemble ? */
export function canPair(a: PairingCard, b: PairingCard): boolean {
  if (a.name === b.name) return false;
  const first = pairingAbilities(a);
  const second = pairingAbilities(b);

  if (first.partner && second.partner) return true;
  if (
    first.partnerGroup !== null &&
    first.partnerGroup.toLowerCase() === second.partnerGroup?.toLowerCase()
  ) {
    return true;
  }
  if (
    first.partnerWith === frontName(b.name) &&
    second.partnerWith === frontName(a.name)
  ) {
    return true;
  }
  if (first.friendsForever && second.friendsForever) return true;
  if (first.chooseABackground && second.background) return true;
  if (second.chooseABackground && first.background) return true;
  if (first.doctorsCompanion && second.doctor) return true;
  if (second.doctorsCompanion && first.doctor) return true;
  return false;
}
