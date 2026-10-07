"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CardImage } from "@/components/cards/card-image";
import type { DeckIssueCode } from "@/domain/commander/validate";
import {
  countCards,
  DECK_ZONES,
  type DeckCard,
  type DeckCardData,
  type DeckZone,
} from "@/domain/deck/deck";
import { type GroupMode, groupDeck } from "@/domain/deck/groups";
import { masonry } from "@/lib/masonry";
import { cn } from "@/lib/utils";
import { CardDialog } from "./card-dialog";
import { DeckList, type Dispatch, dropTarget, entryId } from "./deck-list";

/** Affichages du deck : piles d'images, grille d'images, liste de texte. */
export const DECK_VIEWS = ["piles", "grid", "list"] as const;

export type DeckView = (typeof DECK_VIEWS)[number];

/** Largeur minimale d'une colonne de piles, et écart entre colonnes (px). */
const PILE_MIN_WIDTH = 160;
const PILE_GAP = 16;

/**
 * Hauteur d'une pile en largeurs de carte, pour la répartition en colonnes :
 * titre, bandeaux des cartes empilées (13 % de la largeur), dernière carte
 * entière (680 / 488 de la largeur).
 */
function pileHeight(cardCount: number): number {
  return 0.25 + (cardCount === 0 ? 0.4 : (cardCount - 1) * 0.13 + 680 / 488);
}

interface BoardGroup {
  id: string;
  title: string;
  cards: DeckCard[];
  /** Texte affiché dans un groupe vide. */
  empty?: string;
  muted?: boolean;
}

/**
 * Le deck, dans l'affichage choisi. Les cartes se glissent d'un groupe à
 * l'autre, à la souris ou au clavier (Espace, flèches, puis Espace) ; en
 * piles et en grille, un clic sur une carte ouvre ses options.
 */
export function DeckBoard({
  deck,
  view,
  mode,
  cardIssues,
  categories,
  dispatch,
  onPreview,
}: {
  deck: DeckCard[];
  view: DeckView;
  mode: GroupMode;
  cardIssues: Record<string, DeckIssueCode[]>;
  /** Catégories proposées à la saisie. */
  categories: string[];
  dispatch: Dispatch;
  onPreview: (card: DeckCardData) => void;
}) {
  const t = useTranslations("DeckEditor");
  const tGroups = useTranslations("DeckGroups");
  const tRoles = useTranslations("CardRoles");
  const grouped = groupDeck(deck, mode);
  const datalistId = useId();
  // Id stable entre serveur et client : sans lui, dnd-kit numérote ses
  // descriptions d'accessibilité avec un compteur global, différent à
  // l'hydratation (aria-describedby="DndDescribedBy-0" puis "-1").
  const dndId = useId();
  const [opened, setOpened] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Espace seulement : Entrée garde son rôle de clic (ouvrir les options).
    useSensor(KeyboardSensor, {
      keyboardCodes: {
        start: ["Space"],
        cancel: ["Escape"],
        end: ["Space"],
      },
    }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const [from, oracleId] = String(active.id).split("|") as [DeckZone, string];
    const target = dropTarget(String(over.id), (role) => tRoles(role));
    if (!target || !DECK_ZONES.includes(from)) return;
    dispatch({
      type: "drop",
      oracleId,
      from,
      to: target.zone,
      category: target.category,
    });
  }

  const groupTitle = (group: (typeof grouped.groups)[number]) =>
    group.kind === "role"
      ? tRoles(group.role ?? "other")
      : group.kind === "type"
        ? tGroups(group.type)
        : (group.category ?? tGroups("uncategorized"));

  const boardGroups: BoardGroup[] = [
    {
      id: "zone:commander",
      title: tGroups("commander"),
      cards: grouped.commanders,
    },
    ...(grouped.groups.length === 0
      ? [
          {
            id: "zone:main",
            title: tGroups("main"),
            cards: [],
            empty: t("emptyDeck"),
          },
        ]
      : grouped.groups.map((group) => ({
          id: group.id,
          title: groupTitle(group),
          cards: group.cards,
        }))),
    {
      id: "zone:maybe",
      title: tGroups("maybe"),
      cards: grouped.maybe,
      empty: t("emptyMaybe"),
      muted: true,
    },
  ];

  const openedEntry = deck.find((entry) => entryId(entry) === opened) ?? null;
  const tileProps = {
    cardIssues,
    onOpen: (entry: DeckCard) => setOpened(entryId(entry)),
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: t("dragInstructions") },
      }}
    >
      <datalist id={datalistId}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      {view === "list" && (
        <DeckList
          grouped={grouped}
          groupTitle={groupTitle}
          cardIssues={cardIssues}
          datalistId={datalistId}
          dispatch={dispatch}
          onPreview={onPreview}
        />
      )}
      {view === "piles" && <PilesView groups={boardGroups} {...tileProps} />}
      {view === "grid" && <GridView groups={boardGroups} {...tileProps} />}
      <CardDialog
        entry={openedEntry}
        cardIssues={cardIssues}
        datalistId={datalistId}
        dispatch={(action) => {
          // La fenêtre suit la carte déplacée vers une autre zone.
          if (action.type === "move") {
            setOpened(`${action.to}|${action.oracleId}`);
          }
          dispatch(action);
        }}
        onClose={() => setOpened(null)}
      />
    </DndContext>
  );
}

/** Largeur d'un élément, suivie quand la fenêtre change de taille. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface TileProps {
  cardIssues: Record<string, DeckIssueCode[]>;
  onOpen: (entry: DeckCard) => void;
}

/**
 * Piles d'images façon Archidekt : les cartes d'un groupe se chevauchent en
 * ne montrant que leur nom ; survoler une carte écarte celles du dessous pour
 * la montrer en entier. Chaque pile va dans la colonne la moins haute, pour
 * occuper toute la largeur sans trou.
 */
function PilesView({
  groups,
  ...tileProps
}: TileProps & { groups: BoardGroup[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const columnCount = Math.max(
    1,
    Math.floor((width + PILE_GAP) / (PILE_MIN_WIDTH + PILE_GAP)),
  );
  const columns = masonry(
    groups,
    (group) => pileHeight(group.cards.length),
    columnCount,
  );

  return (
    <div
      ref={ref}
      className="grid items-start gap-4"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {columns.map((column, index) => (
        <div
          key={column[0]?.id ?? `empty-${index}`}
          className="grid min-w-0 gap-5"
        >
          {column.map((group) => (
            <BoardGroupSection key={group.id} group={group}>
              {group.cards.length > 0 ? (
                <div
                  className="deck-pile"
                  style={
                    { "--pile-count": group.cards.length } as CSSProperties
                  }
                >
                  {group.cards.map((entry, index) => (
                    <CardTile
                      key={entryId(entry)}
                      entry={entry}
                      className="deck-pile-slot"
                      style={{ "--pile-index": index } as CSSProperties}
                      {...tileProps}
                    />
                  ))}
                </div>
              ) : (
                <EmptyGroup text={group.empty} />
              )}
            </BoardGroupSection>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Grille : chaque groupe sur toute la largeur, cartes entières côte à côte. */
function GridView({
  groups,
  ...tileProps
}: TileProps & { groups: BoardGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <BoardGroupSection key={group.id} group={group}>
          {group.cards.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
              {group.cards.map((entry) => (
                <CardTile
                  key={entryId(entry)}
                  entry={entry}
                  className="relative transition-transform hover:-translate-y-1"
                  {...tileProps}
                />
              ))}
            </div>
          ) : (
            <EmptyGroup text={group.empty} />
          )}
        </BoardGroupSection>
      ))}
    </div>
  );
}

/** Groupe du deck où l'on peut déposer une carte. */
function BoardGroupSection({
  group,
  children,
}: {
  group: BoardGroup;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: group.id });
  const headingId = useId();
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-group={group.id}
      className={cn(
        "@container min-w-0 rounded-lg transition-colors",
        group.muted && "opacity-90",
        isOver && "bg-primary/10 outline-2 outline-primary outline-dashed",
      )}
    >
      <h3
        id={headingId}
        className="flex items-baseline justify-between gap-2 pb-1.5 font-semibold text-sm"
      >
        <span className="truncate">{group.title}</span>
        <span className="text-muted-foreground tabular-nums">
          {countCards(group.cards)}
        </span>
      </h3>
      {children}
    </section>
  );
}

function EmptyGroup({ text }: { text?: string }) {
  return (
    <p className="rounded-lg border border-dashed px-3 py-4 text-muted-foreground text-xs">
      {text}
    </p>
  );
}

/** Image d'une carte du deck : glisser pour la déplacer, cliquer pour ses options. */
function CardTile({
  entry,
  cardIssues,
  onOpen,
  className,
  style,
}: TileProps & {
  entry: DeckCard;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useTranslations("DeckEditor");
  const tIssues = useTranslations("DeckValidation.short");
  const { card, zone, quantity } = entry;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: entryId(entry) });
  const issues = zone === "maybe" ? [] : (cardIssues[entry.oracleId] ?? []);
  const issueText = issues.map((code) => tIssues(code)).join(" · ");

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-card={card.name}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(entry)}
      aria-label={t("cardTile", { name: card.name, count: quantity })}
      aria-description={issueText || undefined}
      title={issueText || undefined}
      style={{
        ...style,
        ...(transform && {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }),
      }}
      className={cn(
        "block w-full cursor-grab touch-none rounded-[4.75%/3.5%] text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        isDragging && "z-50 opacity-80 shadow-xl",
        className,
      )}
    >
      <CardImage
        imageUris={card.imageUris}
        name={card.name}
        decorative
        sizes="(min-width: 1024px) 200px, 45vw"
        className={cn(
          "shadow-sm",
          issues.length > 0 && "ring-2 ring-destructive",
        )}
      />
      {quantity > 1 && (
        <span className="absolute right-1.5 bottom-1.5 rounded-full bg-foreground px-1.5 font-medium text-background text-xs tabular-nums">
          ×{quantity}
        </span>
      )}
      {issues.length > 0 && (
        <CircleAlert
          className="absolute top-1.5 right-1.5 size-5 rounded-full bg-background text-destructive"
          aria-hidden
        />
      )}
    </button>
  );
}
