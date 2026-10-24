import { CircleAlert, CircleCheck, Folder, Plus } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { CardImage } from "@/components/cards/card-image";
import { ColorIdentity } from "@/components/decks/color-identity";
import { DeckListControls } from "@/components/decks/deck-list-controls";
import {
  DeckFolders,
  DeckOrganizer,
  DeckTile,
  type FolderViewKey,
} from "@/components/decks/deck-organizer";
import { DeckStatusBadge } from "@/components/decks/deck-status";
import { buttonVariants } from "@/components/ui/button";
import { DECK_STATUSES } from "@/domain/collection/ownership";
import { COMMANDER_DECK_SIZE } from "@/domain/deck/deck";
import {
  deckListQueryToParams,
  inFolder,
  parseDeckListQuery,
  selectDecks,
} from "@/domain/deck/deck-list";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireSession } from "@/server/auth/session";
import { listDecks } from "@/server/decks/decks";
import { listDeckFolders } from "@/server/decks/folders";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/decks">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "DecksPage",
  });
  return { title: t("title") };
}

export default async function DecksPage({
  params,
  searchParams,
}: PageProps<"/[locale]/decks">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { user } = await requireSession(locale as Locale, "/decks");
  const t = await getTranslations("DecksPage");
  const tStatus = await getTranslations("DeckStatus");
  const format = await getFormatter();
  const [decks, folderList] = await Promise.all([
    listDecks(user.id),
    listDeckFolders(user.id),
  ]);
  const currency = locale === "en" ? "USD" : "EUR";
  const parsed = parseDeckListQuery(await searchParams);
  // Un dossier supprimé ou d'un autre utilisateur : tous les decks.
  const query =
    typeof parsed.folder === "object" &&
    !folderList.some(
      (folder) =>
        typeof parsed.folder === "object" && folder.id === parsed.folder.id,
    )
      ? { ...parsed, folder: "all" as const }
      : parsed;
  const view: FolderViewKey =
    typeof query.folder === "object" ? query.folder.id : query.folder;
  const folders = folderList.map((folder) => ({
    ...folder,
    count: decks.filter((deck) => deck.folderId === folder.id).length,
  }));
  const counts = {
    all: decks.length,
    favorites: decks.filter((deck) => deck.favorite).length,
    none: decks.filter((deck) => deck.folderId === null).length,
  };
  const shown = selectDecks(decks, query, { currency });
  // Nombre de decks par statut, avec les autres filtres.
  const unfiltered = selectDecks(decks, query, {
    currency,
    ignoreStatus: true,
  });
  const urlQuery = deckListQueryToParams(query);
  const { folder: _folder, ...paramsWithoutFolder } = urlQuery;
  const { status: _status, ...paramsWithoutStatus } = urlQuery;
  const filters = [undefined, ...DECK_STATUSES].map((value) => ({
    value,
    label: value ? tStatus(value) : t("filterAll"),
    count: value
      ? unfiltered.filter((deck) => deck.status === value).length
      : unfiltered.length,
  }));
  const filtered =
    query.q !== "" ||
    query.colors.length > 0 ||
    query.status !== null ||
    query.validity !== null;
  const folderEmpty =
    !filtered &&
    decks.filter((deck) => inFolder(deck, query.folder)).length === 0;
  const folderTitle =
    view === "all"
      ? t("allDecks")
      : view === "favorites"
        ? t("favorites")
        : view === "none"
          ? t("noFolder")
          : folderList.find((folder) => folder.id === view)?.name;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-semibold text-3xl tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("count", { count: decks.length })}
          </p>
        </div>
        <Link href="/decks/new" className={buttonVariants()}>
          <Plus aria-hidden />
          {t("newDeck")}
        </Link>
      </div>

      {decks.length === 0 && folderList.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <p className="font-medium">{t("empty")}</p>
          <p className="mt-1 text-muted-foreground text-sm">{t("emptyHint")}</p>
        </div>
      ) : (
        <DeckOrganizer>
          <div className="grid items-start gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
            <aside className="max-md:hidden md:sticky md:top-4">
              <DeckFolders
                folders={folders}
                counts={counts}
                view={view}
                query={paramsWithoutFolder}
              />
            </aside>
            <div className="min-w-0 space-y-4">
              <h2 className="font-semibold text-xl max-md:sr-only">
                {folderTitle}
              </h2>
              <DeckListControls
                settings={{
                  folder: view,
                  q: query.q,
                  colors: query.colors,
                  status: query.status,
                  validity: query.validity,
                  sort: query.sort,
                }}
                folders={folders}
                counts={counts}
              />
              <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <Link
                    key={filter.value ?? "all"}
                    href={{
                      pathname: "/decks",
                      query: filter.value
                        ? { ...paramsWithoutStatus, status: filter.value }
                        : paramsWithoutStatus,
                    }}
                    aria-current={
                      filter.value === (query.status ?? undefined)
                        ? "page"
                        : undefined
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      filter.value === (query.status ?? undefined) &&
                        "border-foreground bg-foreground text-background hover:bg-foreground",
                    )}
                  >
                    {filter.label}
                    <span className="ml-1.5 tabular-nums opacity-70">
                      {filter.count}
                    </span>
                  </Link>
                ))}
              </nav>
              {shown.length === 0 ? (
                <div className="space-y-2 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                  <p className="text-muted-foreground">
                    {!folderEmpty
                      ? t("noMatch")
                      : view === "favorites"
                        ? t("emptyFavorites")
                        : t("emptyFolder")}
                  </p>
                  {filtered && (
                    <Link
                      href={{
                        pathname: "/decks",
                        query: deckListQueryToParams({
                          folder: query.folder,
                          sort: query.sort,
                        }),
                      }}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t("clearFilters")}
                    </Link>
                  )}
                </div>
              ) : (
                <ul
                  data-testid="deck-list"
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {shown.map((deck) => {
                    const [cover, partner] = deck.commanders;
                    const commanderLine = deck.commanders
                      .map((card) => card.name)
                      .join(" & ");
                    const folder =
                      view === "all" || view === "favorites"
                        ? folderList.find((item) => item.id === deck.folderId)
                        : undefined;
                    return (
                      <DeckTile key={deck.id} deck={deck} folders={folders}>
                        <Link
                          href={`/decks/${deck.id}/edit`}
                          draggable={false}
                          title={t("updated", {
                            date: format.dateTime(deck.updatedAt, {
                              dateStyle: "medium",
                            }),
                          })}
                          className="group grid h-full grid-cols-[4rem_minmax(0,1fr)] grid-rows-[1fr_auto] gap-x-3.5 rounded-xl border bg-card p-3.5 text-card-foreground outline-none transition-colors hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          {partner ? (
                            // Deux commandants : le second se pose sur le
                            // premier, décalé vers le haut à droite, les deux
                            // inclinés.
                            <div className="relative h-24 pt-3.5">
                              <CardImage
                                imageUris={cover?.imageUris ?? null}
                                name={cover?.name ?? deck.name}
                                decorative
                                sizes="50px"
                                className="w-[3.125rem] origin-bottom-left -rotate-6"
                              />
                              <CardImage
                                imageUris={partner.imageUris}
                                name={partner.name}
                                decorative
                                sizes="50px"
                                className="absolute top-0 left-4 w-[3.125rem] rotate-6 shadow-md"
                              />
                            </div>
                          ) : (
                            <CardImage
                              imageUris={cover?.imageUris ?? null}
                              name={cover?.name ?? deck.name}
                              decorative
                              sizes="64px"
                            />
                          )}
                          <div className="min-w-0 space-y-2">
                            <div className="min-w-0 pr-[3.75rem]">
                              <h3 className="line-clamp-2 font-semibold leading-snug group-hover:underline">
                                {deck.name}
                              </h3>
                              {/* Le commandant seulement s'il diffère du nom du deck. */}
                              {commanderLine !== deck.name && (
                                <p className="truncate text-muted-foreground text-sm">
                                  {commanderLine || t("noCommander")}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <ColorIdentity mask={deck.colorIdentity} />
                              <DeckStatusBadge status={deck.status} />
                            </div>
                            {deck.missingCopies > 0 && (
                              <p className="truncate font-medium text-destructive text-xs">
                                {t("missingCopies", {
                                  count: deck.missingCopies,
                                })}
                              </p>
                            )}
                            {folder && (
                              <p className="flex items-center gap-1 text-muted-foreground text-xs">
                                <Folder
                                  className="size-3.5 shrink-0"
                                  aria-hidden
                                />
                                <span className="truncate">{folder.name}</span>
                              </p>
                            )}
                          </div>
                          <div className="col-span-2 mt-3 flex items-center justify-between gap-3 border-t pt-2.5 text-sm">
                            <span className="flex min-w-0 items-center gap-1.5">
                              {deck.valid ? (
                                <CircleCheck
                                  className="size-4 shrink-0 text-primary"
                                  aria-hidden
                                />
                              ) : (
                                <CircleAlert
                                  className="size-4 shrink-0 text-destructive"
                                  aria-hidden
                                />
                              )}
                              <span className="truncate tabular-nums">
                                {t("cards", {
                                  count: deck.cardCount,
                                  expected: COMMANDER_DECK_SIZE,
                                })}
                              </span>
                              {/* La validité se lit à l'icône et à sa couleur. */}
                              <span className="sr-only">
                                {`, ${deck.valid ? t("valid") : t("invalid")}`}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">
                              {format.number(
                                currency === "EUR"
                                  ? deck.priceEur
                                  : deck.priceUsd,
                                { style: "currency", currency },
                              )}
                            </span>
                          </div>
                        </Link>
                      </DeckTile>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </DeckOrganizer>
      )}
    </div>
  );
}
