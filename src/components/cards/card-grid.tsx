import { useFormatter } from "next-intl";
import { CardImage } from "@/components/cards/card-image";
import { Link } from "@/i18n/navigation";
import type { CardSummary } from "@/server/cards/search";

export type PriceCurrency = "EUR" | "USD";

/** Grille de résultats : image, nom et prix de chaque carte. */
export function CardGrid({
  cards,
  currency,
}: {
  cards: CardSummary[];
  currency: PriceCurrency;
}) {
  const format = useFormatter();

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card, index) => {
        const price = currency === "EUR" ? card.priceEur : card.priceUsd;
        return (
          <li key={card.oracleId}>
            <Link
              href={`/cards/${card.oracleId}`}
              className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <CardImage
                imageUris={card.imageUris}
                name={card.name}
                decorative
                sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
                priority={index < 5}
                className="transition-transform group-hover:-translate-y-0.5"
              />
              <span className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium group-hover:underline">
                  {card.name}
                </span>
                {price !== null && (
                  <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                    {format.number(price, { style: "currency", currency })}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
