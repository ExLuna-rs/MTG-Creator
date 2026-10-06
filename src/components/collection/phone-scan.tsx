"use client";

import { Check, Copy, Smartphone, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { ScannedCard, ScanSessionStatus } from "@/server/collection/scan";
import { QrCode } from "./qr-code";

/** Intervalle entre deux interrogations du serveur pendant le scan. */
const POLL_MS = 2000;

interface Link {
  id: string;
  url: string;
}

/**
 * « Scanner avec mon téléphone » : crée un lien de scan, l'affiche en QR code,
 * puis suit en direct les cartes scannées par le téléphone, qui s'ajoutent à
 * la collection affichée.
 */
export function PhoneScan() {
  const t = useTranslations("PhoneScan");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [error, setError] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expired, setExpired] = useState(false);
  const [scanned, setScanned] = useState<ScannedCard[]>([]);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  // Cartes scannées déjà affichées.
  const shownIds = useRef("");

  async function createLink() {
    setError(false);
    setExpired(false);
    setConnected(false);
    setScanned([]);
    shownIds.current = "";
    setLink(null);
    try {
      const response = await fetch("/api/scan/sessions", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      const { id, token }: { id: string; token: string } =
        await response.json();
      // Le jeton est dans le fragment (#) : il n'est jamais envoyé au
      // serveur avec l'adresse de la page, ni gardé dans ses journaux.
      setLink({ id, url: `${window.location.origin}/${locale}/scan#${token}` });
    } catch {
      setError(true);
    }
  }

  function show() {
    setOpen(true);
    dialog.current?.showModal();
    if (!link || expired) void createLink();
  }

  // Suit le lien de scan tant que la fenêtre est ouverte.
  useEffect(() => {
    if (!open || !link || expired) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (!link) return;
      try {
        const response = await fetch(`/api/scan/sessions/${link.id}`);
        if (cancelled) return;
        if (response.status === 404) {
          setExpired(true);
          return;
        }
        if (response.ok) {
          const status: ScanSessionStatus = await response.json();
          if (cancelled) return;
          setConnected(status.connected);
          setExpired(status.expired);
          // Nouvelle carte ou ajout annulé : la collection affichée change.
          const ids = status.cards.map((card) => card.id).join();
          if (ids !== shownIds.current) {
            shownIds.current = ids;
            setScanned(status.cards);
            router.refresh();
          }
        }
      } catch {
        // Réseau indisponible : nouvel essai au prochain tour.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, link, expired, router]);

  async function disconnect() {
    if (link) {
      await fetch(`/api/scan/sessions/${link.id}`, { method: "DELETE" }).catch(
        () => undefined,
      );
    }
    setLink(null);
    dialog.current?.close();
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Button variant="outline" onClick={show}>
        <Smartphone aria-hidden />
        {t("open")}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="phone-scan-title"
        onClose={() => setOpen(false)}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="phone-scan-title" className="font-semibold text-lg">
              {t("title")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="-mt-1 -mr-2"
              aria-label={t("close")}
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{t("instructions")}</p>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {t("error")}
            </p>
          )}

          {link && !expired && (
            <div className="flex flex-col items-center gap-3">
              <QrCode
                value={link.url}
                label={t("qrLabel")}
                className="size-56 rounded-md"
              />
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? t("copied") : t("copyLink")}
              </Button>
              {/* Lien en clair pour les tests et les lecteurs d'écran. */}
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="sr-only"
                data-testid="scan-link"
              >
                {link.url}
              </a>
            </div>
          )}

          <p role="status" className="flex items-center gap-2 text-sm">
            {expired ? (
              <>
                {t("expired")}
                <Button variant="link" size="sm" onClick={createLink}>
                  {t("newLink")}
                </Button>
              </>
            ) : (
              link && (
                <>
                  <span
                    aria-hidden
                    className={
                      connected
                        ? "size-2 rounded-full bg-primary"
                        : "size-2 animate-pulse rounded-full bg-muted-foreground"
                    }
                  />
                  {connected ? t("connected") : t("waiting")}
                </>
              )
            )}
          </p>

          <section aria-labelledby="phone-scan-cards" className="space-y-2">
            <h3 id="phone-scan-cards" className="font-medium text-sm">
              {t("scanned")}
            </h3>
            {scanned.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noneYet")}</p>
            ) : (
              <ul className="flex max-h-48 flex-col-reverse gap-1 overflow-y-auto">
                {scanned.map((card) => (
                  <li key={card.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6 shrink-0">
                      <CardImage
                        imageUris={card.imageUris}
                        name={card.name}
                        decorative
                        sizes="24px"
                      />
                    </span>
                    {card.name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {link && !expired && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={disconnect}>
                {t("disconnect")}
              </Button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
