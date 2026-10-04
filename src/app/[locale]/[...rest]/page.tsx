import { notFound } from "next/navigation";

// Toute URL inconnue sous /fr ou /en affiche la page 404 traduite.
export default function CatchAllPage() {
  notFound();
}
