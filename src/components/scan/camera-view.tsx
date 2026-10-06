"use client";

import { Camera, CameraOff, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { guideRect, nameBand, type Rect } from "@/domain/scan/frame";
import { createNameReader, type NameReader } from "./name-reader";

/** Pause entre deux lectures de l'image. */
const READ_INTERVAL_MS = 600;

type CameraState =
  | "idle"
  | "starting"
  | "loading"
  | "running"
  | "unavailable"
  | "denied";

/** Rectangle en pourcentages de l'image, pour le dessiner par-dessus la vidéo. */
function toPercent(rect: Rect, width: number, height: number) {
  return {
    left: `${(rect.x / width) * 100}%`,
    top: `${(rect.y / height) * 100}%`,
    width: `${(rect.width / width) * 100}%`,
    height: `${(rect.height / height) * 100}%`,
  };
}

/**
 * Caméra arrière du téléphone, avec un cadre de visée au format d'une carte.
 * Le nom est lu en continu sur l'image, dans le navigateur : l'image ne
 * quitte jamais le téléphone, seul le texte lu est transmis à `onReading`.
 */
export function CameraView({
  onReading,
}: {
  onReading: (text: string) => Promise<void>;
}) {
  const t = useTranslations("Scanner");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const reader = useRef<NameReader | null>(null);
  const running = useRef(false);
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const [state, setState] = useState<CameraState>("idle");
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  function stop() {
    running.current = false;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setState("idle");
  }

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }
    setState("starting");
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

    setState("loading");
    try {
      reader.current ??= await createNameReader();
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

  async function loop() {
    while (running.current && reader.current && video.current) {
      try {
        const text = await reader.current.read(video.current);
        if (!running.current) break;
        await onReadingRef.current(text);
      } catch {
        // Lecture ou réseau en échec : on passe à l'image suivante.
      }
      await new Promise((resolve) => setTimeout(resolve, READ_INTERVAL_MS));
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

  const active =
    state === "starting" || state === "loading" || state === "running";
  const guide = size && guideRect(size.width, size.height);

  return (
    <div className="space-y-3" data-camera={state}>
      <div
        className={
          active ? "relative overflow-hidden rounded-lg bg-black" : "hidden"
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
          className="block h-auto max-h-[70vh] w-full object-contain"
        />
        {guide && size && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute rounded-[4.75%/3.5%] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={toPercent(guide, size.width, size.height)}
            />
            <div
              className="absolute rounded-sm border border-primary border-dashed"
              style={toPercent(nameBand(guide), size.width, size.height)}
            />
          </div>
        )}
        {state === "loading" && (
          <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 p-2 text-sm text-white">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("loadingOcr")}
          </p>
        )}
      </div>

      {state === "unavailable" && (
        <p role="alert" className="text-muted-foreground text-sm">
          {t("cameraUnavailable")}
        </p>
      )}
      {state === "denied" && (
        <p role="alert" className="text-muted-foreground text-sm">
          {t("cameraDenied")}
        </p>
      )}
      {active ? (
        <>
          <p className="text-muted-foreground text-sm">{t("cameraHint")}</p>
          <Button variant="outline" className="w-full" onClick={stop}>
            <CameraOff aria-hidden />
            {t("stopCamera")}
          </Button>
        </>
      ) : (
        <Button size="lg" className="w-full" onClick={start}>
          <Camera aria-hidden />
          {t("startCamera")}
        </Button>
      )}
    </div>
  );
}
