import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { cache } from "react";
import { z } from "zod";
import { CardImage } from "@/components/cards/card-image";
import { ManaText, OracleText } from "@/components/cards/mana-text";
import { PrintingList } from "@/components/cards/printing-list";
import { buttonVariants } from "@/components/ui/button";
import {
  type CardFace,
  DISPLAYED_FORMATS,
  isLegality,
  type Legality,
} from "@/domain/cards/card";
import { parseBackLink, printingMarketLinks } from "@/domain/cards/links";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { listPrintings } from "@/server/cards/printings";
import { getCard } from "@/server/cards/search";

const idSchema = z.uuid();

// Partagé entre generateMetadata et la page : une seule requête par visite.
const loadCard = cache(async (id: string) => {
  const oracleId = idSchema.safeParse(id);
  return oracleId.success ? getCard(oracleId.data) : null;
});

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cards/[id]">): Promise<Metadata> {
  const { id } = await params;
  const card = await loadCard(id);
  if (!card) return {};
  return {
    title: card.name,
    description: [card.typeLine, card.oracleText]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 300),
  };
}

const LEGALITY_STYLES: Record<Legality, string> = {
  legal: "border-mana-g/40 bg-mana-g/15",
  not_legal: "text-muted-foreground",
  banned: "border-destructive/40 bg-destructive/10",
  restricted: "border-mana-w/60 bg-mana-w/25",
};

function legalityOf(value: string | undefined): Legality {
  return value && isLegality(value) ? value : "not_legal";
}

/** Nom, coût, type, texte et caractéristiques d'une face. */
async function FaceDetails({
  face,
  withName,
}: {
  face: CardFace;
  withName: boolean;
}) {
  const t = await getTranslations("CardPage");
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground">
      {withName && (
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-semibold text-lg">{face.name}</h2>
          {face.manaCost && (
            <p className="shrink-0 text-lg">
              <ManaText text={face.manaCost} />
            </p>
          )}
        </div>
      )}
      {face.typeLine && <p className="font-medium">{face.typeLine}</p>}
      {face.oracleText && <OracleText text={face.oracleText} />}
      {face.power !== null && face.toughness !== null && (
        <p className="font-medium">
          {t("powerToughness", {
            power: face.power,
            toughness: face.toughness,
          })}
        </p>
      )}
      {face.loyalty !== null && (
        <p className="font-medium">{t("loyalty", { value: face.loyalty })}</p>
      )}
      {face.defense !== null && (
        <p className="font-medium">{t("defense", { value: face.defense })}</p>
      )}
    </section>
  );
}

export default async function CardPage({
  params,
  searchParams,
}: PageProps<"/[locale]/cards/[id]">) {
  const { locale, id } = await params;
  const query = await searchParams;
  const back = parseBackLink(query.from);
  setRequestLocale(locale as Locale);
  const card = await loadCard(id);
  if (!card) notFound();
  const printings = await listPrintings(card.oracleId);
  // Version affichée : celle demandée (`v`), sinon l'édition par défaut.
  const printing =
    printings.find((item) => item.id === query.v) ??
    printings.find((item) => item.id === card.scryfallId) ??
    null;
  const currency = locale === "en" ? "USD" : "EUR";

  const t = await getTranslations("CardPage");
  const tFormats = await getTranslations("Formats");
  const format = await getFormatter();

  const multiFace = card.faces.length > 1;
  // Recto verso : une image par face. Sinon (cartes scindées, aventures…),
  // une seule image pour toute la carte.
  const images = printing
    ? [
        {
          name: card.faces[0]?.name ?? card.name,
          imageUris: printing.imageUris,
        },
        ...(printing.backImageUris
          ? [
              {
                name: t("backFace", { name: card.faces[1]?.name ?? card.name }),
                imageUris: printing.backImageUris,
              },
            ]
          : []),
      ]
    : multiFace && card.faces.every((face) => face.imageUris)
      ? card.faces.map((face, index) => ({
          name: index === 0 ? face.name : t("backFace", { name: face.name }),
          imageUris: face.imageUris,
        }))
      : [{ name: card.name, imageUris: card.imageUris }];
  const commanderLegality = legalityOf(card.commanderLegality);
  // Lien externe tiré des données importées : seul Scryfall est accepté.
  const scryfallUrl = card.scryfallUri.startsWith("https://scryfall.com/")
    ? card.scryfallUri
    : null;
  const markets = printingMarketLinks(
    printing ?? { cardmarketId: null, tcgplayerId: null },
    card.name,
    locale,
  );
  const shown = printing ?? {
    setName: card.setName,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    artist: card.artist,
    priceEur: card.priceEur,
    priceUsd: card.priceUsd,
    priceEurFoil: null,
    priceUsdFoil: null,
  };
  const price = (value: number | null, currency: "EUR" | "USD") =>
    value === null
      ? t("priceUnavailable")
      : format.number(value, { style: "currency", currency });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <Link
        href={back.href}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-3",
        )}
      >
        <ArrowLeft aria-hidden />
        {back.page === "collection" ? t("backToCollection") : t("back")}
      </Link>

      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          {images.map((image, index) => (
            <CardImage
              // biome-ignore lint/suspicious/noArrayIndexKey: liste figée
              key={index}
              imageUris={image.imageUris}
              name={image.name}
              sizes="(min-width: 1024px) 384px, (min-width: 768px) 320px, 100vw"
              priority={index === 0}
              className="mx-auto max-w-sm shadow-md"
            />
          ))}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-semibold text-3xl tracking-tight">
                {card.name}
              </h1>
              {!multiFace && card.manaCost && (
                <p className="shrink-0 pt-1 text-xl">
                  <ManaText text={card.manaCost} />
                </p>
              )}
            </div>
            <ul className="flex flex-wrap gap-2 text-sm">
              <li
                className={cn(
                  "rounded-full border px-3 py-0.5",
                  LEGALITY_STYLES[commanderLegality],
                )}
              >
                {t("commanderStatus", { status: t(commanderLegality) })}
              </li>
              {card.canBeCommander && (
                <li className="rounded-full border border-primary/40 bg-primary/10 px-3 py-0.5">
                  {t("canBeCommander")}
                </li>
              )}
              {card.gameChanger && (
                <li className="rounded-full border border-mana-r/40 bg-mana-r/15 px-3 py-0.5">
                  {t("gameChanger")}
                </li>
              )}
              <li className="rounded-full border px-3 py-0.5 text-muted-foreground">
                {t("manaValue", { value: format.number(card.manaValue) })}
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            {card.faces.map((face, index) => (
              // Deux faces peuvent porter le même nom (cartes réversibles).
              // biome-ignore lint/suspicious/noArrayIndexKey: liste figée
              <FaceDetails key={index} face={face} withName={multiFace} />
            ))}
          </div>

          <section aria-labelledby="legalities" className="space-y-3">
            <h2 id="legalities" className="font-semibold text-lg">
              {t("legalities")}
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {DISPLAYED_FORMATS.map((formatId) => {
                const legality = legalityOf(card.legalities[formatId]);
                return (
                  <div
                    key={formatId}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-1.5",
                      LEGALITY_STYLES[legality],
                    )}
                  >
                    <dt>{tFormats(formatId)}</dt>
                    <dd className="whitespace-nowrap font-medium">
                      {t(legality)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section aria-labelledby="prices" className="space-y-3">
            <h2 id="prices" className="font-semibold text-lg">
              {t("prices")}
            </h2>
            <dl className="grid gap-2 text-sm sm:max-w-md">
              {[
                {
                  label: t("priceEur"),
                  value: price(shown.priceEur, "EUR"),
                  foil: shown.priceEurFoil,
                  currency: "EUR" as const,
                  href: markets.cardmarket,
                  link: t("viewOnCardmarket"),
                },
                {
                  label: t("priceUsd"),
                  value: price(shown.priceUsd, "USD"),
                  foil: shown.priceUsdFoil,
                  currency: "USD" as const,
                  href: markets.tcgplayer,
                  link: t("viewOnTcgplayer"),
                },
              ].map((market) => (
                <div
                  key={market.href}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border px-3 py-1.5"
                >
                  <div>
                    <dt className="text-muted-foreground">{market.label}</dt>
                    <dd className="font-medium tabular-nums">
                      {market.value}
                      {market.foil !== null && (
                        <span className="ml-2 font-normal text-muted-foreground text-xs">
                          {t("priceFoil", {
                            price: format.number(market.foil, {
                              style: "currency",
                              currency: market.currency,
                            }),
                          })}
                        </span>
                      )}
                    </dd>
                  </div>
                  <dd>
                    <a
                      href={market.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {market.link}
                      <ExternalLink aria-hidden />
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="details" className="space-y-2">
            <h2 id="details" className="font-semibold text-lg">
              {t("details")}
            </h2>
            <ul className="space-y-1 text-muted-foreground text-sm">
              {card.edhrecRank !== null && (
                <li>
                  {t("edhrecRank", { rank: format.number(card.edhrecRank) })}
                </li>
              )}
              <li>
                {t("set", {
                  set: shown.setName,
                  code: shown.setCode.toUpperCase(),
                  number: shown.collectorNumber,
                })}
              </li>
              {shown.artist && <li>{t("artist", { artist: shown.artist })}</li>}
            </ul>
            {scryfallUrl && (
              <a
                href={scryfallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "mt-2")}
              >
                {t("viewOnScryfall")}
                <ExternalLink aria-hidden />
              </a>
            )}
          </section>

          {printings.length > 1 && printing && (
            <PrintingList
              printings={printings}
              selectedId={printing.id}
              name={card.name}
              oracleId={card.oracleId}
              from={typeof query.from === "string" ? query.from : undefined}
              currency={currency}
            />
          )}
        </div>
      </div>
    </div>
  );
}
