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
import {
  ChevronDown,
  CircleAlert,
  GripVertical,
  Minus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useState } from "react";
import { ManaText, OracleText } from "@/components/cards/mana-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maxCopies } from "@/domain/commander/singleton";
import type { DeckIssueCode } from "@/domain/commander/validate";
import {
  countCards,
  DECK_ZONES,
  type DeckCard,
  type DeckCardData,
  type DeckZone,
} from "@/domain/deck/deck";
import type { EditorAction } from "@/domain/deck/editor";
import { MAX_QUANTITY } from "@/domain/deck/editor";
import { type GroupMode, groupDeck } from "@/domain/deck/groups";
import { cn } from "@/lib/utils";
import { CardHoverPreview, type HoveredCard } from "./card-hover-preview";

type Dispatch = (action: EditorAction) => void;

const entryId = (entry: DeckCard) => `${entry.zone}|${entry.oracleId}`;

/** Zone et catégorie visées par un dépôt sur un groupe. */
function dropTarget(
  groupId: string,
): { zone: DeckZone; category?: string | null } | null {
  if (groupId === "zone:commander") return { zone: "commander" };
  if (groupId === "zone:maybe") return { zone: "maybe" };
  if (groupId === "zone:main" || groupId.startsWith("type:")) {
    return { zone: "main" };
  }
  if (groupId.startsWith("category:")) {
    const category = groupId.slice("category:".length);
    return { zone: "main", category: category === "" ? null : category };
  }
  return null;
}

/**
 * Liste du deck : commandant(s), cartes regroupées par type ou par catégorie,
 * cartes à considérer. Les cartes se glissent d'un groupe à l'autre, à la
 * souris ou au clavier (Espace sur la poignée, flèches, puis Espace).
 * Survoler une carte affiche son aperçu.
 */
export function DeckList({
  deck,
  mode,
  cardIssues,
  categories,
  dispatch,
}: {
  deck: DeckCard[];
  mode: GroupMode;
  cardIssues: Record<string, DeckIssueCode[]>;
  /** Catégories proposées à la saisie. */
  categories: string[];
  dispatch: Dispatch;
}) {
  const t = useTranslations("DeckEditor");
  const tGroups = useTranslations("DeckGroups");
  const grouped = groupDeck(deck, mode);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const datalistId = useId();
  const [hovered, setHovered] = useState<HoveredCard | null>(null);

  // L'aperçu suit la ligne : il disparaît dès que la page défile.
  useEffect(() => {
    if (!hovered) return;
    const hide = () => setHovered(null);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [hovered]);

  function onPreview(card: DeckCardData | null, element?: Element) {
    setHovered(
      card && element
        ? { card, anchor: element.getBoundingClientRect() }
        : null,
    );
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const [from, oracleId] = String(active.id).split("|") as [DeckZone, string];
    const target = dropTarget(String(over.id));
    if (!target || !DECK_ZONES.includes(from)) return;
    dispatch({
      type: "drop",
      oracleId,
      from,
      to: target.zone,
      category: target.category,
    });
  }

  const rowProps = {
    cardIssues,
    datalistId,
    dispatch,
    onPreview,
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => setHovered(null)}
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
      <div className="space-y-6">
        <Group
          id="zone:commander"
          title={tGroups("commander")}
          count={countCards(grouped.commanders)}
        >
          {grouped.commanders.map((entry) => (
            <CardRow key={entryId(entry)} entry={entry} {...rowProps} />
          ))}
        </Group>

        {grouped.groups.length === 0 ? (
          <Group id="zone:main" title={tGroups("main")} count={0}>
            <p className="px-2 py-3 text-muted-foreground text-sm">
              {t("emptyDeck")}
            </p>
          </Group>
        ) : (
          grouped.groups.map((group) => (
            <Group
              key={group.id}
              id={group.id}
              title={
                group.kind === "type"
                  ? tGroups(group.type)
                  : (group.category ?? tGroups("uncategorized"))
              }
              count={countCards(group.cards)}
            >
              {group.cards.map((entry) => (
                <CardRow key={entryId(entry)} entry={entry} {...rowProps} />
              ))}
            </Group>
          ))
        )}

        <Group
          id="zone:maybe"
          title={tGroups("maybe")}
          count={countCards(grouped.maybe)}
          muted
        >
          {grouped.maybe.length === 0 ? (
            <p className="px-2 py-3 text-muted-foreground text-sm">
              {t("emptyMaybe")}
            </p>
          ) : (
            grouped.maybe.map((entry) => (
              <CardRow key={entryId(entry)} entry={entry} {...rowProps} />
            ))
          )}
        </Group>
      </div>
      {hovered && <CardHoverPreview hovered={hovered} />}
    </DndContext>
  );
}

function Group({
  id,
  title,
  count,
  muted = false,
  children,
}: {
  id: string;
  title: string;
  count: number;
  muted?: boolean;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const headingId = useId();
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-group={id}
      className={cn(
        "rounded-lg border p-2 transition-colors",
        muted && "border-dashed",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <h3
        id={headingId}
        className="flex items-baseline justify-between px-2 pb-1 font-semibold text-sm"
      >
        <span>{title}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </h3>
      <ul className="divide-y">{children}</ul>
    </section>
  );
}

function CardRow({
  entry,
  cardIssues,
  datalistId,
  dispatch,
  onPreview,
}: {
  entry: DeckCard;
  cardIssues: Record<string, DeckIssueCode[]>;
  datalistId: string;
  dispatch: Dispatch;
  onPreview: (card: DeckCardData | null, element?: Element) => void;
}) {
  const t = useTranslations("DeckEditor");
  const tGroups = useTranslations("DeckGroups");
  const tIssues = useTranslations("DeckValidation.short");
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const detailsId = useId();
  const { card, zone, oracleId, quantity } = entry;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: entryId(entry) });
  const issues = zone === "maybe" ? [] : (cardIssues[oracleId] ?? []);
  const limit = Math.min(maxCopies(card), MAX_QUANTITY);

  function addCategory() {
    if (!newCategory.trim()) return;
    dispatch({
      type: "setCategories",
      oracleId,
      zone,
      categories: [...entry.categories, newCategory],
    });
    setNewCategory("");
  }

  return (
    <li
      ref={setNodeRef}
      data-card={card.name}
      onMouseEnter={(event) =>
        !isDragging && onPreview(card, event.currentTarget)
      }
      onMouseLeave={() => onPreview(null)}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        "relative bg-background",
        isDragging && "z-10 rounded-md opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-center gap-1.5 px-1 py-1">
        <button
          type="button"
          className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={t("dragHandle", { name: card.name })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        {zone === "commander" ? (
          <span className="w-[4.75rem] shrink-0 text-center text-muted-foreground text-sm tabular-nums">
            {quantity}
          </span>
        ) : (
          <QuantityStepper
            name={card.name}
            quantity={quantity}
            limit={limit}
            onChange={(value) =>
              dispatch({ type: "setQuantity", oracleId, zone, quantity: value })
            }
          />
        )}
        <button
          type="button"
          onFocus={(event) =>
            onPreview(card, event.currentTarget.closest("li") ?? undefined)
          }
          onBlur={() => onPreview(null)}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="min-w-0 flex-1 truncate rounded-sm text-left text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {card.name}
        </button>
        {issues.length > 0 && (
          <span
            className="shrink-0 text-destructive"
            title={issues.map((code) => tIssues(code)).join(" · ")}
          >
            <CircleAlert className="size-4" aria-hidden />
            <span className="sr-only">
              {issues.map((code) => tIssues(code)).join(" · ")}
            </span>
          </span>
        )}
        {card.manaCost && (
          <span className="hidden shrink-0 text-xs sm:inline">
            <ManaText text={card.manaCost} />
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setOpen(!open)}
          aria-label={t("showDetails", { name: card.name })}
          aria-expanded={open}
          aria-controls={detailsId}
        >
          <ChevronDown
            className={cn("transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={() => dispatch({ type: "remove", oracleId, zone })}
          aria-label={t("remove", { name: card.name })}
          title={t("remove", { name: card.name })}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      <div
        id={detailsId}
        hidden={!open}
        className="space-y-3 border-t bg-muted/40 px-3 py-3 text-sm"
      >
        <p className="text-muted-foreground text-xs">{card.typeLine}</p>
        {/* Sur grand écran, l'aperçu au survol montre déjà le texte. */}
        {open && card.oracleText && (
          <OracleText text={card.oracleText} className="text-xs lg:hidden" />
        )}
        <div className="flex flex-wrap gap-2">
          {DECK_ZONES.filter((target) => target !== zone).map((target) => (
            <Button
              key={target}
              variant="outline"
              size="sm"
              onClick={() =>
                dispatch({ type: "move", oracleId, from: zone, to: target })
              }
            >
              {t("moveTo", { zone: tGroups(target) })}
            </Button>
          ))}
        </div>
        {zone === "main" && (
          <div className="space-y-2">
            <p className="font-medium text-xs">{t("categories")}</p>
            {entry.categories.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {entry.categories.map((category, index) => (
                  <li
                    key={category}
                    className={cn(
                      "flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2 text-xs",
                      index === 0 && "border-primary",
                    )}
                  >
                    {category}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-accent"
                      aria-label={t("removeCategory", { category })}
                      onClick={() =>
                        dispatch({
                          type: "setCategories",
                          oracleId,
                          zone,
                          categories: entry.categories.filter(
                            (item) => item !== category,
                          ),
                        })
                      }
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addCategory();
              }}
            >
              <Input
                list={datalistId}
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                maxLength={40}
                aria-label={t("newCategory", { name: card.name })}
                placeholder={t("newCategoryPlaceholder")}
                className="h-8"
              />
              <Button type="submit" variant="outline" size="sm">
                {t("addCategory")}
              </Button>
            </form>
            <p className="text-muted-foreground text-xs">
              {t("categoriesHint")}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Boutons − et + autour de la quantité. Le − à un exemplaire retire la carte
 * (Annuler la remet). Le + s'arrête à la limite Commander de la carte : un
 * seul exemplaire, sauf terrains de base et exceptions, pour lesquels la
 * quantité se saisit aussi au clavier.
 */
function QuantityStepper({
  name,
  quantity,
  limit,
  onChange,
}: {
  name: string;
  quantity: number;
  limit: number;
  onChange: (value: number) => void;
}) {
  const t = useTranslations("DeckEditor");
  const atLimit = quantity >= limit;
  return (
    <div className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground"
        onClick={() => onChange(quantity - 1)}
        aria-label={t("decrease", { name })}
        title={t("decrease", { name })}
      >
        <Minus className="size-3.5" aria-hidden />
      </Button>
      {limit > 1 ? (
        <QuantityInput
          value={quantity}
          max={limit}
          label={t("quantityOf", { name })}
          onChange={onChange}
        />
      ) : (
        <span className="w-7 text-center text-sm tabular-nums">{quantity}</span>
      )}
      {/* Un bouton désactivé n'affiche pas d'infobulle : elle est sur son conteneur. */}
      <span
        title={atLimit ? t("copyLimit", { count: limit, name }) : undefined}
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          disabled={atLimit}
          onClick={() => onChange(quantity + 1)}
          aria-label={t("increase", { name })}
          aria-description={
            atLimit ? t("copyLimit", { count: limit, name }) : undefined
          }
          title={atLimit ? undefined : t("increase", { name })}
        >
          <Plus className="size-3.5" aria-hidden />
        </Button>
      </span>
    </div>
  );
}

/** Quantité modifiable : la saisie en cours peut être vide sans rien changer. */
function QuantityInput({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={draft ?? value}
      aria-label={label}
      onChange={(event) => {
        setDraft(event.target.value);
        const number = event.target.valueAsNumber;
        if (Number.isInteger(number) && number >= 0) onChange(number);
      }}
      onBlur={() => setDraft(null)}
      className="h-7 w-10 shrink-0 rounded-md border border-input bg-background px-1 text-center text-sm tabular-nums"
    />
  );
}
