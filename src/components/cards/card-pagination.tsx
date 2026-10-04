import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import {
  type CardSearch,
  cardSearchToQuery,
} from "@/domain/cards/search-query";
import { Link } from "@/i18n/navigation";

/** Liens « page précédente » et « page suivante » d'une recherche. */
export function CardPagination({
  search,
  pageCount,
}: {
  search: CardSearch;
  pageCount: number;
}) {
  const t = useTranslations("CardSearch");
  if (pageCount <= 1 && search.page <= 1) return null;

  const href = (page: number) => ({
    pathname: "/cards",
    query: cardSearchToQuery({ ...search, page }),
  });
  // Une page au-delà de la dernière (URL modifiée) renvoie vers la dernière.
  const previous = Math.min(search.page - 1, pageCount);
  const linkClassName = buttonVariants({ variant: "outline" });

  return (
    <nav
      aria-label={t("pagination")}
      className="flex items-center justify-between gap-4"
    >
      {previous >= 1 ? (
        <Link href={href(previous)} rel="prev" className={linkClassName}>
          <ChevronLeft aria-hidden />
          {t("previous")}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-muted-foreground text-sm tabular-nums">
        {t("pageOf", { page: search.page, pageCount })}
      </p>
      {search.page < pageCount ? (
        <Link href={href(search.page + 1)} rel="next" className={linkClassName}>
          {t("next")}
          <ChevronRight aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
