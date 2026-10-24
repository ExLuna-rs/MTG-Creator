import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { RARITIES } from "@/domain/cards/card";
import {
  activeFilters,
  type CardSearch,
  cardSearchToQuery,
  colorFilter,
  type FilterGroup,
  withoutFilter,
  withoutFilters,
} from "@/domain/cards/search-query";
import { Link } from "@/i18n/navigation";

/**
 * Filtres actifs au-dessus des résultats, visibles même panneau fermé :
 * chacun est un lien vers la même recherche sans lui (sans JavaScript aussi).
 */
export function ActiveFilters({
  search,
  pathname = "/cards",
  keep = {},
}: {
  search: CardSearch;
  /** Page des liens (la collection réutilise les filtres). */
  pathname?: "/cards" | "/collection";
  /** Paramètres de la page gardés tels quels. */
  keep?: Record<string, string>;
}) {
  const t = useTranslations("ActiveFilters");
  const tSearch = useTranslations("CardSearch");
  const tColors = useTranslations("Colors");
  const tTypes = useTranslations("CardTypes");
  const tRarities = useTranslations("Rarities");
  const groups = activeFilters(search);
  if (groups.length === 0) return null;

  function label(group: FilterGroup): string {
    switch (group) {
      case "colors": {
        const filter = colorFilter(search);
        if (!filter || filter.mode === "colorless") return t("colorless");
        return t(filter.source === "card" ? "cardColors" : "colors", {
          mode: t(`colorMode.${filter.mode}`),
          colors: filter.colors.map((color) => tColors(color)).join(", "),
        });
      }
      case "types":
        return t("types", {
          types: [
            ...search.types.map((type) => tTypes(type)),
            ...search.subtypes,
          ].join(t(search.typeMode === "and" ? "and" : "or")),
        });
      case "manaValue": {
        const { manaValueMin: min, manaValueMax: max } = search;
        if (min !== null && max !== null) {
          return t("manaValueRange", { min, max });
        }
        return min !== null
          ? t("manaValueMin", { min })
          : t("manaValueMax", { max: max ?? 0 });
      }
      case "rarities":
        return t("rarities", {
          rarities: RARITIES.filter((rarity) =>
            search.rarities.includes(rarity),
          )
            .map((rarity) => tRarities(rarity))
            .join(", "),
        });
      case "text":
        return t("text", { text: search.text });
      default:
        return tSearch(group);
    }
  }

  return (
    <ul aria-label={t("label")} className="flex flex-wrap items-center gap-2">
      {groups.map((group) => {
        const text = label(group);
        return (
          <li key={group} className="min-w-0 max-w-full">
            <Link
              href={{
                pathname,
                query: {
                  ...keep,
                  ...cardSearchToQuery(withoutFilter(search, group)),
                },
              }}
              aria-label={t("remove", { label: text })}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary bg-primary/10 py-1 pr-2 pl-3 text-sm outline-none transition-colors hover:bg-primary/20 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="truncate">{text}</span>
              <X
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
      <li>
        <Link
          href={{
            pathname,
            query: { ...keep, ...cardSearchToQuery(withoutFilters(search)) },
          }}
          className="rounded-md px-2 py-1 font-medium text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {t("clearAll")}
        </Link>
      </li>
    </ul>
  );
}
