"use client";

import { Camera, LoaderCircle, X, Zap, ZapOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type Quad,
  quadShift,
  STEADY_SHIFT,
  smoothQuad,
} from "@/domain/scan/card-quad";
import { type CardDetector, createCardDetector } from "./card-detector";
import { createNameReader, type NameReader, type Reading } from "./name-reader";

/** Intervalle entre deux détections du contour (≈ 12 images par seconde). */
const DETECT_INTERVAL_MS = 80;
/** Images sans carte avant de considérer qu'elle a quitté l'écran. */
const MISSED_FRAMES = 4;

type CameraState =
  | "idle"
  | "starting"
  | "loading"
  | "running"
  | "unavailable"
  | "denied";

/** Lampe du téléphone (contrainte non standard, absente des types du DOM). */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * Caméra arrière en plein écran, à la manière des applications de scan : le
 * contour de la carte est détecté et suivi en continu (OpenCV.js), puis, dès
 * que la carte est immobile, la bande du nom est redressée et lue
 * (Tesseract.js). Tout se passe dans le navigateur : l'image ne quitte jamais
 * le téléphone, seul le texte lu est transmis à `onReading`.
 */
export function CameraView({
  onReading,
  onActiveChange,
  paused = false,
  recognized = false,
  actions,
  overlay,
}: {
  onReading: (reading: Reading) => Promise<void>;
  onActiveChange?: (active: boolean) => void;
  /** Lecture suspendue (liste de scan ouverte, par exemple). */
  paused?: boolean;
  /** Une carte vient d'être reconnue : le contour passe au vert. */
  recognized?: boolean;
  /** Boutons de la barre latérale, sous ceux de la caméra. */
  actions?: ReactNode;
  /** Affiché en bas de l'écran (carte trouvée, choix, consigne). */
  overlay?: ReactNode;
}) {
  const t = useTranslations("Scanner");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const reader = useRef<NameReader | null>(null);
  const detector = useRef<CardDetector | null>(null);
  const running = useRef(false);
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [state, setState] = useState<CameraState>("idle");
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [quad, setQuad] = useState<Quad | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);

  const active =
    state === "starting" || state === "loading" || state === "running";
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  useEffect(() => {
    onActiveChangeRef.current?.(active);
    if (!active) return;
    // Plein écran : la page ne défile plus derrière la caméra.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [active]);

  function stop() {
    running.current = false;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setQuad(null);
    setTorch(null);
    setState("idle");
  }

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("starting");
    // Les bibliothèques se chargent pendant que la caméra s'ouvre.
    const libraries = Promise.all([
      reader.current ?? createNameReader(),
      detector.current ?? createCardDetector(),
    ]);
    libraries.catch(() => undefined);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    } catch (error) {
      setState(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "denied"
          : "unavailable",
      );
      return;
    }
    const element = video.current;
    if (!element) return;
    element.srcObject = stream.current;
    await element.play().catch(() => undefined);
    const [track] = stream.current.getVideoTracks();
    const capabilities = track?.getCapabilities?.() as
      | TorchCapabilities
      | undefined;
    if (capabilities?.torch) setTorch(false);

    setState("loading");
    try {
      [reader.current, detector.current] = await libraries;
    } catch {
      stop();
      setState("unavailable");
      return;
    }
    if (!stream.current) return;
    setState("running");
    running.current = true;
    void loop();
  }

  async function toggleTorch() {
    const [track] = stream.current?.getVideoTracks() ?? [];
    if (!track || torch === null) return;
    const next = !torch;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorch(next);
    } catch {
      setTorch(null);
    }
  }

  /**
   * Boucle de détection : suit le contour à chaque image ; quand la carte
   * est immobile et que la lecture précédente est finie, lit son nom.
   */
  async function loop() {
    let previous: Quad | null = null;
    let shown: Quad | null = null;
    let missed = MISSED_FRAMES;
    let reading = false;
    while (running.current && detector.current && video.current) {
      const started = performance.now();
      let found: Quad | null = null;
      try {
        found = detector.current.detect(video.current);
      } catch {
        // Image illisible : on passe à la suivante.
      }
      if (found) {
        missed = 0;
        shown = smoothQuad(shown, found);
        setQuad(shown);
        const steady =
          previous !== null && quadShift(previous, found) < STEADY_SHIFT;
        if (steady && !reading && !pausedRef.current && reader.current) {
          reading = true;
          const band = detector.current.nameBand(video.current, found);
          void reader.current
            .read(band)
            .then((text) =>
              running.current
                ? onReadingRef.current({ verdict: "read", text })
                : undefined,
            )
            .catch(() => undefined)
            .finally(() => {
              reading = false;
            });
        }
      } else if (++missed === MISSED_FRAMES) {
        // La carte a quitté l'écran : l'ajout est réarmé.
        shown = null;
        setQuad(null);
        void onReadingRef.current({ verdict: "empty" }).catch(() => undefined);
      }
      previous = found;
      const elapsed = performance.now() - started;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, DETECT_INTERVAL_MS - elapsed)),
      );
    }
  }

  // Coupe la caméra et libère l'OCR en quittant la page.
  useEffect(
    () => () => {
      running.current = false;
      for (const track of stream.current?.getTracks() ?? []) track.stop();
      void reader.current?.terminate();
    },
    [],
  );

  const sideButton =
    "size-11 rounded-full text-white hover:bg-white/15 hover:text-white";

  return (
    <div>
      {/* Toujours présente pour recevoir le flux, affichée en plein écran. */}
      <div
        data-camera={state}
        className={
          active
            ? "fixed inset-0 z-40 h-dvh overflow-hidden bg-black"
            : "hidden"
        }
      >
        <video
          ref={video}
          muted
          playsInline
          onLoadedMetadata={(event) =>
            setSize({
              width: event.currentTarget.videoWidth,
              height: event.currentTarget.videoHeight,
            })
          }
          className="absolute inset-0 size-full object-cover"
        />
        {/* Contour de la carte, dans le repère de la vidéo (même recadrage). */}
        {size && quad && (
          <svg
            aria-hidden
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="xMidYMid slice"
            className="pointer-events-none absolute inset-0 size-full"
            data-testid="card-outline"
          >
            <polygon
              points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={recognized ? "rgba(74,222,128,0.18)" : "none"}
              stroke={recognized ? "#4ade80" : "#fbbf24"}
              strokeWidth={Math.max(size.width, size.height) / 160}
              strokeLinejoin="round"
              className="transition-[fill,stroke] duration-200"
            />
          </svg>
        )}

        {/* Barre latérale : quitter, lampe, puis les boutons de la page. */}
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-3 flex flex-col items-center gap-2 rounded-full bg-black/55 p-1.5 text-white backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className={sideButton}
            aria-label={t("stopCamera")}
            onClick={stop}
          >
            <X aria-hidden className="size-6" />
          </Button>
          {actions}
          {torch !== null && (
            <Button
              variant="ghost"
              size="icon"
              className={sideButton}
              aria-label={torch ? t("torchOff") : t("torchOn")}
              aria-pressed={torch}
              onClick={toggleTorch}
            >
              {torch ? (
                <ZapOff aria-hidden className="size-6" />
              ) : (
                <Zap aria-hidden className="size-6" />
              )}
            </Button>
          )}
        </div>

        <div className="absolute inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] text-white">
          {state === "running" ? (
            overlay
          ) : (
            <p className="mx-auto flex w-fit items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              {state === "loading" ? t("loadingOcr") : t("startingCamera")}
            </p>
          )}
        </div>
      </div>

      {state === "unavailable" && (
        <p role="alert" className="mb-3 text-muted-foreground text-sm">
          {t("cameraUnavailable")}
        </p>
      )}
      {state === "denied" && (
        <p role="alert" className="mb-3 text-muted-foreground text-sm">
          {t("cameraDenied")}
        </p>
      )}
      {!active && (
        <Button size="lg" className="h-14 w-full text-base" onClick={start}>
          <Camera aria-hidden />
          {t("startCamera")}
        </Button>
      )}
    </div>
  );
}
