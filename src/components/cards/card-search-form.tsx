"use client";

import { Check, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type FormEvent,
  type ReactNode,
  useId,
  useState,
  useTransition,
} from "react";
import { CardNameInput } from "@/components/cards/card-name-input";
import { ManaSymbol } from "@/components/cards/mana-text";
import { SetInput, type SetOption } from "@/components/cards/set-input";
import { SubtypeInput } from "@/components/cards/subtype-input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";
import { RARITIES } from "@/domain/cards/card";
import {
  CARD_SORTS,
  type CardSearch,
  COLOR_MODES,
  COLOR_SOURCES,
  type ColorMode,
  type ColorSource,
  countActiveFilters,
  defaultCardSort,
  IDENTITY_FILTER_COLORS,
  TYPE_MODES,
  type TypeMode,
} from "@/domain/cards/search-query";
import { CARD_TYPES } from "@/domain/cards/type-line";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** État des champs du formulaire, tel que saisi. */
interface Draft {
  q: string;
  text: string;
  color: string[];
  cmode: ColorMode;
  csrc: ColorSource;
  type: string[];
  sub: string[];
  /** Sous-type en cours de saisie, pas encore ajouté. */
  subText: string;
  tmode: TypeMode;
  rarity: string[];
  /** Extensions choisies, avec leur nom pour les pastilles. */
  set: SetOption[];
  /** Extension en cours de saisie. */
  setText: string;
  mvMin: string;
  mvMax: string;
  legal: boolean;
  commander: boolean;
  gc: boolean;
  /** Vide : tri par défaut (pertinence avec un nom, sinon popularité). */
  sort: string;
}

const EMPTY_DRAFT: Draft = {
  q: "",
  text: "",
  color: [],
  cmode: "within",
  csrc: "identity",
  type: [],
  sub: [],
  subText: "",
  tmode: "or",
  rarity: [],
  set: [],
  setText: "",
  mvMin: "",
  mvMax: "",
  legal: false,
  commander: false,
  gc: false,
  sort: "",
};

function toDraft(search: CardSearch, sets: readonly SetOption[]): Draft {
  return {
    q: search.name,
    text: search.text,
    color: search.colors,
    cmode: search.colorMode,
    csrc: search.colorSource,
    type: search.types,
    sub: search.subtypes,
    subText: "",
    tmode: search.typeMode,
    rarity: search.rarities,
    // Code inconnu de la base (URL trafiquée ou extension disparue) : affiché tel quel.
    set: search.sets.map(
      (code) =>
        sets.find((set) => set.code === code) ?? {
          code,
          name: code.toUpperCase(),
          releasedAt: "",
        },
    ),
    setText: "",
    mvMin: search.manaValueMin?.toString() ?? "",
    mvMax: search.manaValueMax?.toString() ?? "",
    legal: search.commanderLegal,
    commander: search.canBeCommander,
    gc: search.gameChanger,
    sort: search.sort === defaultCardSort(search) ? "" : search.sort,
  };
}

/** Paramètres d'URL du formulaire, sans les champs vides. */
function toQuery(draft: Draft): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const key of ["q", "text", "mvMin", "mvMax", "sort"] as const) {
    const value = draft[key].trim();
    if (value) query[key] = value;
  }
  for (const key of ["color", "type", "rarity"] as const) {
    if (draft[key].length > 0) query[key] = draft[key];
  }
  for (const key of ["legal", "commander", "gc"] as const) {
    if (draft[key]) query[key] = "1";
  }
  if (draft.set.length > 0) query.set = draft.set.map((set) => set.code);
  const subtypes = [...draft.sub, draft.subText.trim()].filter(Boolean);
  if (subtypes.length > 0) query.sub = subtypes;
  if (draft.cmode !== "within") query.cmode = draft.cmode;
  if (draft.csrc !== "identity") query.csrc = draft.csrc;
  if (draft.tmode !== "or") query.tmode = draft.tmode;
  return query;
}

/** Cases « Options » : paramètre d'URL et libellé. */
const FLAG_OPTIONS = [
  ["legal", "commanderLegal"],
  ["commander", "canBeCommander"],
  ["gc", "gameChanger"],
] as const;

function toggle(values: string[], value: string, checked: boolean): string[] {
  return checked ? [...values, value] : values.filter((item) => item !== value);
}

const inputClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm";

/** Case à cocher affichée comme une pastille. */
function Chip({
  name,
  value,
  checked,
  onCheckedChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="group relative inline-flex select-none items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        // Case invisible posée sur toute la pastille : c'est elle qu'on clique.
        className="absolute inset-0 z-10 cursor-pointer appearance-none rounded-full opacity-0"
      />
      <Check
        className="hidden size-3.5 text-primary group-has-checked:block"
        aria-hidden
      />
      {children}
    </label>
  );
}

/** Choix exclusif affiché comme des boutons accolés (boutons radio). */
function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onValueChange,
  label,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onValueChange: (value: T) => void;
  label: (option: T) => string;
}) {
  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="text-muted-foreground text-sm">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option}
            className="relative cursor-pointer select-none rounded-md border px-3 py-1 font-medium text-sm transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onValueChange(option)}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            />
            {label(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Group({
  legend,
  hint,
  select,
  children,
}: {
  legend: string;
  hint?: string;
  /** Sur téléphone, liste déroulante à choix multiple à la place des pastilles. */
  select?: {
    options: readonly MultiSelectOption[];
    values: string[];
    onValuesChange: (values: string[]) => void;
  };
  children: ReactNode;
}) {
  const t = useTranslations("CardSearch");
  const hintId = useId();
  return (
    <fieldset
      className="min-w-0 space-y-2"
      aria-describedby={hint ? hintId : undefined}
    >
      <legend className="font-medium text-sm">{legend}</legend>
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {select && (
        <MultiSelect
          label={legend}
          placeholder={t("selectPlaceholder")}
          removeLabel={(option) => t("removeChoice", { name: option })}
          {...select}
          className="md:hidden [@media(scripting:none)]:hidden"
        />
      )}
      {/* Les pastilles portent les champs du formulaire : masquées, elles sont
          quand même envoyées (et affichées sans JavaScript). */}
      <div
        className={cn(
          "flex flex-wrap gap-2",
          select && "max-md:hidden [@media(scripting:none)]:flex",
        )}
      >
        {children}
      </div>
    </fieldset>
  );
}

/**
 * Formulaire de recherche. Il fonctionne sans JavaScript (formulaire GET
 * classique) ; avec, il navigue côté client vers une URL sans champs vides.
 * Les champs suivent l'URL : retour arrière, pagination, réinitialisation.
 */
export function CardSearchForm({
  search,
  action,
  pathname = "/cards",
  keep = {},
  filtersOnly = false,
  sets = [],
}: {
  search: CardSearch;
  /** Chemin de la page de recherche, langue comprise (sans JavaScript). */
  action: string;
  /** Page de destination (la collection réutilise les filtres). */
  pathname?: "/cards" | "/collection";
  /** Paramètres de la page gardés tels quels (recherche, tri de la collection). */
  keep?: Record<string, string>;
  /** Seulement les filtres, repliés : sans le nom ni le tri des cartes. */
  filtersOnly?: boolean;
  /** Extensions de la recherche, pour afficher leur nom. */
  sets?: readonly SetOption[];
}) {
  const t = useTranslations("CardSearch");
  const tColors = useTranslations("Colors");
  const tTypes = useTranslations("CardTypes");
  const tRarities = useTranslations("Rarities");
  const tSorts = useTranslations("Sorts");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();

  const activeFilters = countActiveFilters(search);
  const [draft, setDraft] = useState(() => toDraft(search, sets));
  const [filtersOpen, setFiltersOpen] = useState(
    !filtersOnly && activeFilters > 0,
  );

  // L'URL a changé (envoi, retour arrière, lien) : les champs la suivent.
  const searchKey = JSON.stringify({ ...search, page: 1 });
  const [syncedKey, setSyncedKey] = useState(searchKey);
  if (searchKey !== syncedKey) {
    setSyncedKey(searchKey);
    setDraft(toDraft(search, sets));
    if (activeFilters > 0 && !filtersOnly) setFiltersOpen(true);
  }

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function submit(next: Draft) {
    const { q: _q, sort: _sort, ...filters } = toQuery(next);
    const query = filtersOnly ? { ...keep, ...filters } : toQuery(next);
    startTransition(() => {
      router.push({ pathname, query });
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(draft);
  }

  return (
    <search aria-label={t("title")}>
      <form action={action} onSubmit={onSubmit} className="space-y-4">
        {filtersOnly ? (
          Object.entries(keep).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-[1_1_16rem] space-y-1.5">
              <label htmlFor={`${id}-q`} className="block font-medium text-sm">
                {t("nameLabel")}
              </label>
              <CardNameInput
                id={`${id}-q`}
                name="q"
                value={draft.q}
                onValueChange={(value) => update("q", value)}
                placeholder={t("namePlaceholder")}
                suggestionsLabel={t("suggestionsLabel")}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`${id}-sort`}
                className="block font-medium text-sm"
              >
                {t("sortLabel")}
              </label>
              <select
                id={`${id}-sort`}
                name="sort"
                value={draft.sort}
                onChange={(event) => {
                  // Changer le tri relance la recherche, comme un bouton.
                  const next = { ...draft, sort: event.target.value };
                  setDraft(next);
                  submit(next);
                }}
                className={cn(inputClassName, "h-10 w-auto pr-8")}
              >
                <option value="">{tSorts("relevance")}</option>
                {CARD_SORTS.filter((sort) => sort !== "relevance").map(
                  (sort) => (
                    <option key={sort} value={sort}>
                      {tSorts(sort)}
                    </option>
                  ),
                )}
              </select>
            </div>
            <Button type="submit" size="lg">
              {pending ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              {t("submit")}
            </Button>
          </div>
        )}

        <details
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
          className="rounded-lg border"
        >
          <summary className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-4 py-2.5 font-medium text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <SlidersHorizontal className="size-4" aria-hidden />
            {t("filters")}
            {activeFilters > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs tabular-nums">
                <span aria-hidden>{activeFilters}</span>
                <span className="sr-only">
                  {t("activeFilters", { count: activeFilters })}
                </span>
              </span>
            )}
          </summary>

          <div className="grid gap-6 border-t p-4 md:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <Group
                legend={t("colorsLabel")}
                select={{
                  options: IDENTITY_FILTER_COLORS.map((color) => ({
                    value: color,
                    label: tColors(color),
                    icon: (
                      <span aria-hidden>
                        <ManaSymbol symbol={`{${color}}`} />
                      </span>
                    ),
                  })),
                  values: draft.color,
                  onValuesChange: (values) => update("color", values),
                }}
              >
                {IDENTITY_FILTER_COLORS.map((color) => (
                  <Chip
                    key={color}
                    name="color"
                    value={color}
                    checked={draft.color.includes(color)}
                    onCheckedChange={(checked) =>
                      update("color", toggle(draft.color, color, checked))
                    }
                  >
                    <span aria-hidden>
                      <ManaSymbol symbol={`{${color}}`} />
                    </span>
                    {tColors(color)}
                  </Chip>
                ))}
              </Group>
              <Segmented
                legend={t("colorModeLabel")}
                name="cmode"
                options={COLOR_MODES}
                value={draft.cmode}
                onValueChange={(value) => update("cmode", value)}
                label={(mode) => t(`colorMode.${mode}`)}
              />
              <Segmented
                legend={t("colorSourceLabel")}
                name="csrc"
                options={COLOR_SOURCES}
                value={draft.csrc}
                onValueChange={(value) => update("csrc", value)}
                label={(source) => t(`colorSource.${source}`)}
              />
              <p className="text-muted-foreground text-xs">
                {t(`colorModeHint.${draft.cmode}`)} {t("colorlessHint")}
              </p>
            </div>
            <div className="min-w-0 space-y-3">
              <Group
                legend={t("typesLabel")}
                select={{
                  options: CARD_TYPES.map((type) => ({
                    value: type,
                    label: tTypes(type),
                  })),
                  values: draft.type,
                  onValuesChange: (values) => update("type", values),
                }}
              >
                {CARD_TYPES.map((type) => (
                  <Chip
                    key={type}
                    name="type"
                    value={type}
                    checked={draft.type.includes(type)}
                    onCheckedChange={(checked) =>
                      update("type", toggle(draft.type, type, checked))
                    }
                  >
                    {tTypes(type)}
                  </Chip>
                ))}
              </Group>
              <div className="space-y-2">
                <label
                  htmlFor={`${id}-sub`}
                  className="block font-medium text-sm"
                >
                  {t("subtypesLabel")}
                </label>
                <SubtypeInput
                  id={`${id}-sub`}
                  values={draft.sub}
                  onValuesChange={(values) => update("sub", values)}
                  text={draft.subText}
                  onTextChange={(text) => update("subText", text)}
                />
              </div>
              <Segmented
                legend={t("typeModeLabel")}
                name="tmode"
                options={TYPE_MODES}
                value={draft.tmode}
                onValueChange={(value) => update("tmode", value)}
                label={(mode) => t(`typeMode.${mode}`)}
              />
            </div>
            <Group legend={t("manaValueLabel")}>
              {(["mvMin", "mvMax"] as const).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  {t(key === "mvMin" ? "manaValueMin" : "manaValueMax")}
                  <input
                    type="number"
                    name={key}
                    min={0}
                    max={20}
                    step={1}
                    inputMode="numeric"
                    value={draft[key]}
                    onChange={(event) => update(key, event.target.value)}
                    className={cn(inputClassName, "w-20")}
                  />
                </label>
              ))}
            </Group>
            <Group
              legend={t("rarityLabel")}
              select={{
                options: RARITIES.map((rarity) => ({
                  value: rarity,
                  label: tRarities(rarity),
                })),
                values: draft.rarity,
                onValuesChange: (values) => update("rarity", values),
              }}
            >
              {RARITIES.map((rarity) => (
                <Chip
                  key={rarity}
                  name="rarity"
                  value={rarity}
                  checked={draft.rarity.includes(rarity)}
                  onCheckedChange={(checked) =>
                    update("rarity", toggle(draft.rarity, rarity, checked))
                  }
                >
                  {tRarities(rarity)}
                </Chip>
              ))}
            </Group>
            <div className="min-w-0 space-y-2">
              <label
                htmlFor={`${id}-set`}
                className="block font-medium text-sm"
              >
                {t("setsLabel")}
              </label>
              <SetInput
                id={`${id}-set`}
                values={draft.set}
                onValuesChange={(values) => update("set", values)}
                text={draft.setText}
                onTextChange={(text) => update("setText", text)}
              />
              <p className="text-muted-foreground text-xs">{t("setsHint")}</p>
            </div>
            <div className="min-w-0 space-y-2">
              <label
                htmlFor={`${id}-text`}
                className="block font-medium text-sm"
              >
                {t("textLabel")}
              </label>
              <input
                id={`${id}-text`}
                type="text"
                name="text"
                maxLength={200}
                placeholder={t("textPlaceholder")}
                value={draft.text}
                onChange={(event) => update("text", event.target.value)}
                className={inputClassName}
              />
            </div>
            <Group
              legend={t("optionsLabel")}
              select={{
                options: FLAG_OPTIONS.map(([key, label]) => ({
                  value: key,
                  label: t(label),
                })),
                values: FLAG_OPTIONS.map(([key]) => key).filter(
                  (key) => draft[key],
                ),
                onValuesChange: (values) =>
                  setDraft((current) => ({
                    ...current,
                    ...Object.fromEntries(
                      FLAG_OPTIONS.map(([key]) => [key, values.includes(key)]),
                    ),
                  })),
              }}
            >
              {FLAG_OPTIONS.map(([key, label]) => (
                <Chip
                  key={key}
                  name={key}
                  value="1"
                  checked={draft[key]}
                  onCheckedChange={(checked) => update(key, checked)}
                >
                  {t(label)}
                </Chip>
              ))}
            </Group>
          </div>

          <div className="flex flex-wrap gap-3 border-t px-4 py-3">
            <Button type="submit">{t("submit")}</Button>
            <Link
              href={{ pathname, query: filtersOnly ? keep : {} }}
              // Même URL possible (champs modifiés mais pas envoyés) : on vide
              // aussi les champs directement.
              onClick={() => setDraft(EMPTY_DRAFT)}
              className={buttonVariants({ variant: "ghost" })}
            >
              {t("reset")}
            </Link>
          </div>
        </details>
      </form>
    </search>
  );
}
