"use client";

import { Check, ChevronDown, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Liste déroulante à choix multiple, à la manière de shadcn/ui : les choix
 * apparaissent en pastilles dans le bouton, la liste reste ouverte pendant
 * qu'on coche. Motif listbox de l'ARIA (`aria-multiselectable`) : le focus
 * reste sur la liste, les flèches la parcourent, Espace ou Entrée cochent,
 * Échap la ferme. Elle n'envoie rien elle-même : le formulaire garde ses
 * propres champs.
 */
export function MultiSelect({
  label,
  options,
  values,
  onValuesChange,
  placeholder,
  removeLabel,
  className,
}: {
  /** Nom accessible du bouton et de la liste. */
  label: string;
  options: readonly MultiSelectOption[];
  values: readonly string[];
  onValuesChange: (values: string[]) => void;
  placeholder: string;
  removeLabel: (option: string) => string;
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.filter((option) => values.includes(option.value));

  // Un clic en dehors ferme la liste.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  function toggle(value: string) {
    onValuesChange(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : // Dans l'ordre de la liste, comme les pastilles.
          options
            .map((option) => option.value)
            .filter((item) => item === value || values.includes(item)),
    );
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => (index + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => (index - 1 + options.length) % options.length);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        toggle(options[active].value);
        break;
      case "Escape":
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={root} className={cn("relative", className)}>
      <div className="flex min-h-10 w-full items-center gap-1 rounded-md border border-input bg-background py-1 pr-1 pl-1.5 shadow-xs has-[button:focus-visible]:border-ring">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selected.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-sm bg-primary/10 py-0.5 pr-0.5 pl-2 text-sm"
            >
              {option.icon}
              {option.label}
              <button
                type="button"
                onClick={() => toggle(option.value)}
                aria-label={removeLabel(option.label)}
                className="grid size-5 place-items-center rounded-sm text-muted-foreground outline-none hover:bg-primary/20 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-label={label}
            onClick={() => setOpen((current) => !current)}
            className="min-w-24 flex-1 rounded-sm px-1.5 py-1 text-left text-muted-foreground text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {selected.length === 0 ? placeholder : null}
          </button>
        </div>
        <ChevronDown
          className={cn(
            "pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </div>
      <div
        ref={list}
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        aria-multiselectable
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        tabIndex={-1}
        hidden={!open}
        onKeyDown={onListKeyDown}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-card p-1 text-card-foreground shadow-lg outline-none"
      >
        {options.map((option, index) => {
          const isSelected = values.includes(option.value);
          return (
            // Clavier géré par la liste (aria-activedescendant).
            // biome-ignore lint/a11y/useKeyWithClickEvents: motif listbox de l'ARIA
            <div
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={isSelected}
              tabIndex={-1}
              onClick={() => {
                setActive(index);
                toggle(option.value);
              }}
              onMouseMove={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm",
                index === active && "bg-accent text-accent-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-[4px] border",
                  isSelected &&
                    "border-primary bg-primary text-primary-foreground",
                )}
                aria-hidden
              >
                {isSelected && <Check className="size-3" />}
              </span>
              {option.icon}
              {option.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
