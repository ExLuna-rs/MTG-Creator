"use client";

import { Check } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  /** Choix courant d'une liste (coché). */
  checked?: boolean;
  destructive?: boolean;
  /** Ligne de séparation avant l'élément. */
  separated?: boolean;
}

/**
 * Menu déroulant (motif « menu button » de l'ARIA) : le bouton l'ouvre, les
 * flèches le parcourent, Entrée choisit, Échap ou un clic en dehors le
 * ferment et rendent le focus au bouton.
 */
export function Menu({
  label,
  trigger,
  heading,
  items,
  className,
  triggerClassName,
  align = "end",
}: {
  /** Nom accessible du bouton et du menu. */
  label: string;
  trigger: ReactNode;
  /** Titre affiché en tête du menu (« Ranger dans »). */
  heading?: string;
  items: readonly MenuItem[];
  className?: string;
  triggerClassName?: string;
  /** Bord du bouton auquel le menu s'aligne. */
  align?: "start" | "end";
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const entries = [
      ...(list.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ??
        []),
    ];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      entries[(next + entries.length) % entries.length]?.focus();
    };
    switch (event.key) {
      case "ArrowDown":
        return move(index + 1);
      case "ArrowUp":
        return move(index - 1);
      case "Home":
        return move(0);
      case "End":
        return move(entries.length - 1);
      case "Escape":
        event.preventDefault();
        return close();
      case "Tab":
        return setOpen(false);
    }
  }

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={list}
          id={`${id}-menu`}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-full z-30 mt-1 grid min-w-52 rounded-lg border bg-card p-1 text-card-foreground text-sm shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {heading && (
            <p className="px-2 pt-1 pb-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              {heading}
            </p>
          )}
          {items.map((item) => {
            const props = {
              type: "button" as const,
              tabIndex: -1,
              onClick: () => {
                close();
                item.onSelect();
              },
              className: cn(
                "flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent",
                item.destructive && "text-destructive",
                item.separated && "mt-1 border-t pt-2",
              ),
            };
            const content = (
              <>
                <span className="min-w-0 truncate">{item.label}</span>
                {item.checked && (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
                )}
              </>
            );
            return item.checked === undefined ? (
              <button key={item.key} role="menuitem" {...props}>
                {content}
              </button>
            ) : (
              <button
                key={item.key}
                role="menuitemradio"
                aria-checked={item.checked}
                {...props}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
