import { useMemo } from "react";
import { encode } from "uqr";

/** QR code d'un texte, dessiné en SVG (un carré par module noir). */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => {
    const { data, size } = encode(value, { ecc: "M", border: 2 });
    const path = data
      .flatMap((row, y) =>
        row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")),
      )
      .join("");
    return { size, path };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Fond blanc même en thème sombre : les lecteurs attendent du noir sur blanc. */}
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
