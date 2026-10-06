import { useFormatter, useTranslations } from "next-intl";
import { ManaSymbol } from "@/components/cards/mana-text";
import { COLORS } from "@/domain/cards/colors";
import { PRIMARY_TYPES } from "@/domain/deck/deck";
import { MANA_CURVE_MAX, type DeckStats as Stats } from "@/domain/deck/stats";

const COLOR_BARS = {
  W: "bg-mana-w",
  U: "bg-mana-u",
  B: "bg-mana-b",
  R: "bg-mana-r",
  G: "bg-mana-g",
} as const;

/**
 * Statistiques du deck, en bandeau : chiffres clés et courbe de mana, types,
 * couleurs demandées comparées aux sources.
 */
export function DeckStats({ stats }: { stats: Stats }) {
  const t = useTranslations("DeckStats");
  const tGroups = useTranslations("DeckGroups");
  const format = useFormatter();
  const curveMax = Math.max(1, ...stats.manaCurve);
  const typeMax = Math.max(1, ...Object.values(stats.typeCounts));
  const colorMax = Math.max(
    1,
    ...COLORS.flatMap((color) => [
      stats.colorPips[color],
      stats.colorSources[color],
    ]),
  );
  // Seules les couleurs demandées par les coûts : une source de mana de
  // toutes les couleurs ne doit pas faire apparaître les couleurs inutiles.
  const usedColors = COLORS.filter((color) => stats.colorPips[color] > 0);

  return (
    <section
      aria-labelledby="stats-title"
      className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
    >
      <h2 id="stats-title" className="sr-only">
        {t("title")}
      </h2>

      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            [t("cards"), format.number(stats.cardCount)],
            [t("lands"), format.number(stats.landCount)],
            [
              t("averageManaValue"),
              format.number(stats.averageManaValue, {
                maximumFractionDigits: 2,
              }),
            ],
            [
              t("price"),
              format.number(stats.price.eur, {
                style: "currency",
                currency: "EUR",
              }),
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="min-w-0 rounded-md border px-2.5 py-1.5"
            >
              <dt
                className="truncate text-muted-foreground text-xs"
                title={label}
              >
                {label}
              </dt>
              <dd className="truncate font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-xs">
          {t("priceDetail", {
            usd: format.number(stats.price.usd, {
              style: "currency",
              currency: "USD",
            }),
            missing: stats.price.missingEur,
          })}
        </p>

        <figure className="space-y-2">
          <figcaption className="font-medium text-sm">
            {t("manaCurve")}
          </figcaption>
          <ol className="flex h-24 items-end gap-1" aria-label={t("manaCurve")}>
            {stats.manaCurve.map((count, manaValue) => {
              const label =
                manaValue === MANA_CURVE_MAX
                  ? `${MANA_CURVE_MAX}+`
                  : String(manaValue);
              return (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: colonnes fixes
                  key={manaValue}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <span
                    className="text-muted-foreground text-xs tabular-nums"
                    aria-hidden
                  >
                    {count}
                  </span>
                  <span
                    className="w-full rounded-t-sm bg-primary/70"
                    style={{ height: `${(count / curveMax) * 70}%` }}
                    aria-hidden
                  />
                  <span className="text-xs tabular-nums" aria-hidden>
                    {label}
                  </span>
                  <span className="sr-only">
                    {t("curveColumn", { count, manaValue: label })}
                  </span>
                </li>
              );
            })}
          </ol>
        </figure>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium text-sm">{t("types")}</h3>
        <ul className="space-y-1 text-sm">
          {PRIMARY_TYPES.filter((type) => stats.typeCounts[type] > 0).map(
            (type) => (
              <li
                key={type}
                className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2"
              >
                <span className="truncate">{tGroups(type)}</span>
                <span className="h-2 rounded-full bg-muted">
                  <span
                    className="block h-2 rounded-full bg-primary/60"
                    style={{
                      width: `${(stats.typeCounts[type] / typeMax) * 100}%`,
                    }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  {stats.typeCounts[type]}
                </span>
              </li>
            ),
          )}
        </ul>
      </div>

      {usedColors.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">{t("colors")}</h3>
          <p className="text-muted-foreground text-xs">{t("colorsHint")}</p>
          <ul className="space-y-2 text-sm">
            {usedColors.map((color) => (
              <li
                key={color}
                className="grid grid-cols-[1.5rem_1fr] items-center gap-2"
              >
                <ManaSymbol symbol={`{${color}}`} />
                <div className="space-y-1">
                  {(
                    [
                      ["pips", stats.colorPips[color], "opacity-100"],
                      ["sources", stats.colorSources[color], "opacity-50"],
                    ] as const
                  ).map(([kind, value, opacity]) => (
                    <div
                      key={kind}
                      className="grid grid-cols-[1fr_auto] items-center gap-2"
                    >
                      <span className="h-2 rounded-full bg-muted">
                        <span
                          className={`block h-2 rounded-full ${COLOR_BARS[color]} ${opacity}`}
                          style={{ width: `${(value / colorMax) * 100}%` }}
                        />
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t(kind, { count: value })}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
