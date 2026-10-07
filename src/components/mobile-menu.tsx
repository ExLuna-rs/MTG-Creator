"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePathname } from "@/i18n/navigation";

/**
 * Menu de l'en-tête sur mobile : un bouton « burger » ouvre un panneau avec
 * la navigation, le compte et la langue. Le panneau se ferme quand on suit
 * un lien ou qu'on change de page.
 */
export function MobileMenu({ children }: { children: ReactNode }) {
  const t = useTranslations("Header");
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Nouvelle page : le menu se referme.
  // biome-ignore lint/correctness/useExhaustiveDependencies: déclenché par le changement de page
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("openMenu")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      {/* Au clavier, Échap ferme déjà la fenêtre et Entrée sur un lien déclenche un clic. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: voir ci-dessus */}
      <dialog
        ref={dialog}
        aria-label={t("menu")}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // Un lien suivi, ou un clic hors du panneau, ferme le menu.
          const target = event.target as HTMLElement;
          if (target === event.currentTarget || target.closest("a")) {
            dialog.current?.close();
          }
        }}
        className="m-0 ml-auto h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        {open && (
          <div className="flex h-full flex-col gap-6 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("closeMenu")}
                onClick={() => dialog.current?.close()}
              >
                <X aria-hidden className="size-5" />
              </Button>
            </div>
            {children}
          </div>
        )}
      </dialog>
    </>
  );
}
