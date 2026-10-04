import type { CardImageUris } from "@/domain/cards/card";
import { cn } from "@/lib/utils";

// Largeurs des images de Scryfall, pour que le navigateur choisisse la bonne.
const SMALL_WIDTH = 146;
const NORMAL_WIDTH = 488;
const LARGE_WIDTH = 672;

/**
 * Image d'une carte, servie directement par le CDN de Scryfall (pas
 * d'optimiseur d'images Next.js). Sans image, un cadre affiche le nom.
 */
export function CardImage({
  imageUris,
  name,
  decorative = false,
  sizes,
  priority = false,
  className,
}: {
  imageUris: CardImageUris | null;
  /** Nom de la carte (ou de la face), utilisé comme texte alternatif. */
  name: string;
  /** Le nom est déjà écrit à côté : l'image n'a pas besoin d'être décrite. */
  decorative?: boolean;
  /** Largeur affichée, au format de l'attribut `sizes`. */
  sizes: string;
  /** Image visible dès l'arrivée sur la page : chargée sans attendre. */
  priority?: boolean;
  className?: string;
}) {
  const frame = cn(
    "aspect-[488/680] w-full rounded-[4.75%/3.5%] bg-muted",
    className,
  );

  if (!imageUris) {
    return (
      <div
        aria-hidden={decorative || undefined}
        className={cn(
          frame,
          "flex items-center justify-center border p-3 text-center text-muted-foreground text-sm",
        )}
      >
        {name}
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: les images viennent du CDN de Scryfall, sans l'optimiseur de Next.js
    <img
      src={imageUris.normal}
      srcSet={`${imageUris.small} ${SMALL_WIDTH}w, ${imageUris.normal} ${NORMAL_WIDTH}w, ${imageUris.large} ${LARGE_WIDTH}w`}
      sizes={sizes}
      width={NORMAL_WIDTH}
      height={680}
      alt={decorative ? "" : name}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn(frame, "h-auto object-cover")}
    />
  );
}
