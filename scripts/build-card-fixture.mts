// Construit le jeu de cartes de test (tests/fixtures/cards.jsonl) à partir
// d'un fichier « Oracle Cards » de Scryfall décompressé :
//   pnpm fixtures:cards chemin/vers/oracle-cards.jsonl
// Le jeu contient les cartes les plus jouées en Commander et des cas
// particuliers (faces multiples, accents, cartes bannies, commandants…).
// Seuls les champs utilisés par l'import sont conservés.
import { readFileSync, writeFileSync } from "node:fs";
import { isDeckCard, type ScryfallCard } from "../src/domain/cards/scryfall";

const MOST_PLAYED = 120;

const SPECIAL_CASES = [
  // Accents, ponctuation et recherche floue
  "Jötun Grunt",
  "Lim-Dûl's Vault",
  "Séance",
  "Ifh-Bíff Efreet",
  "Nazgûl",
  "Sol Ring",
  "Lightning Bolt",
  "Counterspell",
  // Mises en page à plusieurs faces
  "Delver of Secrets // Insectile Aberration",
  "Esika, God of the Tree // The Prismatic Bridge",
  "Fire // Ice",
  "Bonecrusher Giant // Stomp",
  "Adventurous Eater // Have a Bite",
  "Akki Lavarunner // Tok-Tok, Volcano Born",
  "Bruna, the Fading Light",
  "Gisela, the Broken Blade",
  "Invasion of Ikoria // Zilortha, Apex of Ikoria",
  "History of Benalia",
  "Wizard Class",
  "Student of Warfare",
  // Commandants : créatures, véhicule, texte, partenaires, Backgrounds…
  "Atraxa, Praetors' Voice",
  "Edgar Markov",
  "The Ur-Dragon",
  "Parhelion II",
  "Teferi, Temporal Archmage",
  "Thrasios, Triton Hero",
  "Tymna the Weaver",
  "Wilson, Refined Grizzly",
  "Guild Artisan",
  "Lurrus of the Dream-Den",
  "Kozilek, the Great Distortion",
  // Cartes bannies en Commander
  "Mana Crypt",
  "Dockside Extortionist",
  "Jeweled Lotus",
  "Black Lotus",
  "Primeval Titan",
  // Terrains de base
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Forest",
  // Exceptions à la règle du singleton
  "Relentless Rats",
  "Shadowborn Apostle",
  "Persistent Petitioners",
  "Seven Dwarves",
  "Dragon's Approach",
  // Coûts particuliers : hybrides, phyrexians, fractions, très grands nombres
  "Kitchen Finks",
  "Dismember",
  "Reaper King",
  "Tamiyo, Compleated Sage",
  "Little Girl",
  "Gleemax",
];

const KEPT_FIELDS = [
  "id",
  "oracle_id",
  "name",
  "layout",
  "mana_cost",
  "cmc",
  "type_line",
  "oracle_text",
  "power",
  "toughness",
  "loyalty",
  "defense",
  "colors",
  "color_identity",
  "keywords",
  "legalities",
  "games",
  "game_changer",
  "edhrec_rank",
  "produced_mana",
  "card_faces",
  "image_uris",
  "prices",
  "rarity",
  "set",
  "set_name",
  "set_type",
  "collector_number",
  "released_at",
  "artist",
  "scryfall_uri",
] as const;

const input = process.argv[2];
if (!input) throw new Error("Chemin du fichier Oracle Cards (.jsonl) attendu.");

const cards = readFileSync(input, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as ScryfallCard)
  .filter(isDeckCard);

const byName = new Map(cards.map((card) => [card.name, card]));
const missing = SPECIAL_CASES.filter((name) => !byName.has(name));
if (missing.length > 0)
  throw new Error(`Cartes introuvables : ${missing.join(", ")}`);

const mostPlayed = cards
  .filter((card) => card.edhrec_rank !== undefined)
  .sort((a, b) => (a.edhrec_rank ?? 0) - (b.edhrec_rank ?? 0))
  .slice(0, MOST_PLAYED);

const selected = new Map<string, ScryfallCard>();
for (const card of [
  ...mostPlayed,
  ...SPECIAL_CASES.map((name) => byName.get(name)),
]) {
  if (card) selected.set(card.name, card);
}

const lines = [...selected.values()]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((card) => {
    const record = card as unknown as Record<string, unknown>;
    const kept = Object.fromEntries(
      KEPT_FIELDS.filter((field) => field in record).map((field) => [
        field,
        record[field],
      ]),
    );
    const prices = card.prices ?? {};
    kept.prices = { usd: prices.usd ?? null, eur: prices.eur ?? null };
    return JSON.stringify(kept);
  });

writeFileSync("tests/fixtures/cards.jsonl", `${lines.join("\n")}\n`);
console.log(`${lines.length} cartes écrites dans tests/fixtures/cards.jsonl`);
