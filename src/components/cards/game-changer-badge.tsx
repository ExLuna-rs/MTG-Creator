import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Pastille « GC » posée dans le coin supérieur gauche d'une image de carte
 * (le parent, positionné, commence par l'image), à cheval sur le bord pour
 * ne pas cacher le nom. Tout en haut de la carte, elle reste visible quand
 * les cartes se chevauchent dans la vue Piles de l'éditeur. Placée après le
 * nom dans le code, pour qu'un lecteur d'écran annonce « Rhystic Study,
 * Game Changer ».
 */
export function GameChangerBadge({ className }: { className?: string }) {
  const t = useTranslations("CardPage");
  return (
    <span
      title={t("gameChanger")}
      className={cn(
        "pointer-events-none absolute top-0.5 -left-2.5 grid size-5 place-items-center rounded-full bg-game-changer font-bold text-[0.5625rem] text-game-changer-foreground shadow ring-2 ring-black/70",
        className,
      )}
    >
      <span aria-hidden>GC</span>
      <span className="sr-only">{t("gameChanger")}</span>
    </span>
  );
}
