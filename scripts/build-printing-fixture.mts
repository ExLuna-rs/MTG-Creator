// Construit les éditions du jeu de test (tests/fixtures/printings.jsonl) pour
// les cartes de tests/fixtures/cards.jsonl, avec l'API de Scryfall :
//   pnpm fixtures:printings
// Pour chaque carte : son édition par défaut et les plus récentes, dans la
// limite de MAX_PER_CARD, plus la plus ancienne. Seuls les champs utilisés
// par l'import sont conservés.
import { readFileSync, writeFileSync } from "node:fs";
import type { ScryfallPrinting } from "../src/domain/cards/printing";
import { isPaperPrinting } from "../src/domain/cards/printing";
import type { ScryfallCard } from "../src/domain/cards/scryfall";

const MAX_PER_CARD = 8;
const USER_AGENT = "MTGCreator/0.1 (+https://github.com/ExLuna-rs/MTG-Creator)";

const KEPT_FIELDS = [
  "id",
  "oracle_id",
  "name",
  "layout",
  "type_line",
  "games",
  "card_faces",
  "image_uris",
  "rarity",
  "set",
  "set_name",
  "set_type",
  "collector_number",
  "released_at",
  "artist",
  "digital",
  "oversized",
  "promo",
  "full_art",
  "textless",
  "variation",
  "border_color",
  "frame_effects",
  "finishes",
  "cardmarket_id",
  "tcgplayer_id",
] as const;

function keep(card: ScryfallPrinting): string {
  const record = card as unknown as Record<string, unknown>;
  const kept = Object.fromEntries(
    KEPT_FIELDS.filter((field) => field in record).map((field) => [
      field,
      record[field],
    ]),
  );
  // Faces : seuls le nom, le type, l'artiste et les images servent.
  if (card.card_faces) {
    kept.card_faces = card.card_faces.map((face) => ({
      name: face.name,
      oracle_id: face.oracle_id,
      type_line: face.type_line,
      artist: face.artist,
      image_uris: face.image_uris,
    }));
  }
  const prices = card.prices ?? {};
  kept.prices = {
    usd: prices.usd ?? null,
    eur: prices.eur ?? null,
    usd_foil: prices.usd_foil ?? null,
    eur_foil: prices.eur_foil ?? null,
  };
  return JSON.stringify(kept);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function prints(oracleId: string): Promise<ScryfallPrinting[]> {
  const url = new URL("https://api.scryfall.com/cards/search");
  url.searchParams.set("q", `oracleid:${oracleId} game:paper`);
  url.searchParams.set("unique", "prints");
  url.searchParams.set("order", "released");
  url.searchParams.set("dir", "desc");
  let response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  // Trop de requêtes : Scryfall demande de ralentir.
  for (let attempt = 1; response.status === 429 && attempt <= 5; attempt++) {
    await wait(2000 * attempt);
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
  }
  if (!response.ok) throw new Error(`Scryfall a répondu ${response.status}.`);
  const { data } = (await response.json()) as { data: ScryfallPrinting[] };
  return data;
}

const cards = readFileSync("tests/fixtures/cards.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as ScryfallCard);

const lines: string[] = [];
for (const card of cards) {
  if (!card.oracle_id) continue;
  const all = (await prints(card.oracle_id)).filter(isPaperPrinting);
  const chosen = new Map<string, ScryfallPrinting>();
  const byDefault = all.find((printing) => printing.id === card.id);
  if (byDefault) chosen.set(byDefault.id, byDefault);
  for (const printing of all) {
    if (chosen.size >= MAX_PER_CARD - 1) break;
    chosen.set(printing.id, printing);
  }
  const oldest = all.at(-1);
  if (oldest) chosen.set(oldest.id, oldest);
  for (const printing of chosen.values()) lines.push(keep(printing));
  await wait(200);
}

writeFileSync("tests/fixtures/printings.jsonl", `${lines.join("\n")}\n`);
console.log(
  `${lines.length} éditions écrites dans tests/fixtures/printings.jsonl`,
);
