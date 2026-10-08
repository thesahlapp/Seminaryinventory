"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { parseQrText } from "@/lib/qr";

type Status = "starting" | "scanning" | "found" | "denied" | "unavailable";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Reads QR codes with the phone's back camera and reports our label paths
 * (e.g. /q/i/<id>). Uses the browser's built-in BarcodeDetector where
 * available (Android Chrome) and falls back to jsQR (iPhone and others).
 * The camera view is always dark, whatever the theme.
 */
export function QrReader({
  onResult,
  initialMessage = null,
  footer,
  className = "",
  continuous = false,
}: {
  onResult: (path: string) => void;
  initialMessage?: string | null;
  footer?: React.ReactNode;
  className?: string;
  /** Keep scanning after a result (e.g. counting several items). */
  continuous?: boolean;
}) {
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let lastNotOurs = "";
    let lastPath = "";
    let lastAt = 0;
    let detector: Detector | null = null;

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
      .BarcodeDetector;
    if (BarcodeDetectorCtor) {
      try {
        detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
      } catch {
        detector = null;
      }
    }

    function handle(text: string) {
      const path = parseQrText(text);
      if (path) {
        // Ignore the same label for a couple of seconds while it's still in view.
        if (continuous && path === lastPath && Date.now() - lastAt < 2500) return;
        lastPath = path;
        lastAt = Date.now();
        if (!continuous) {
          stopped = true;
          setStatus("found");
        }
        if (navigator.vibrate) navigator.vibrate(60);
        setMessage(null);
        onResultRef.current(path);
      } else if (text !== lastNotOurs) {
        lastNotOurs = text;
        setMessage("That code isn't a Qalam label. Try another.");
      }
    }

    async function tick() {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && video.videoWidth) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) handle(codes[0].rawValue);
          } else {
            const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
              if (code?.data) handle(code.data);
            }
          }
        } catch {
          // A frame that couldn't be read; try the next one.
        }
      }
      if (!stopped) frame = window.setTimeout(() => requestAnimationFrame(tick), 120);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
        if (capabilities?.torch) setTorch({ on: false, track });
        tick();
      } catch (err) {
        const name = (err as DOMException)?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [continuous]);

  async function toggleTorch() {
    if (!torch) return;
    const on = !torch.on;
    await torch.track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {});
    setTorch({ ...torch, on });
  }

  return (
    <div className={`flex flex-col bg-black text-white ${className}`}>
      <div className="relative flex-1 overflow-hidden lg:aspect-video lg:flex-none lg:rounded-t-2xl">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {/* Viewfinder */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative size-64 max-w-[70vw] max-h-[70vw]">
            {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map(
              (corner) => (
                <span key={corner} className={`absolute size-10 rounded-sm border-white ${corner}`} />
              ),
            )}
          </div>
        </div>
        {torch && (
          <button
            type="button"
            onClick={toggleTorch}
            className="absolute right-4 top-4 rounded-full bg-black/60 px-4 py-2 text-sm font-medium"
            aria-pressed={torch.on}
          >
            {torch.on ? "Light off" : "Light on"}
          </button>
        )}
        {status !== "scanning" && status !== "found" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            {status === "starting" && <p>Starting camera…</p>}
            {status === "denied" && (
              <div className="max-w-sm space-y-2">
                <p className="text-lg font-semibold">Camera access is blocked</p>
                <p className="text-sm text-white/80">
                  Allow camera access for this site in your browser settings, then reload. On iPhone: Settings → Safari →
                  Camera → Allow (or tap “aA” in the address bar → Website Settings).
                </p>
              </div>
            )}
            {status === "unavailable" && (
              <div className="max-w-sm space-y-2">
                <p className="text-lg font-semibold">No camera available</p>
                <p className="text-sm text-white/80">This device or browser can&apos;t open the camera. Use search instead.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-3 px-4 py-4 text-center">
        <p className="text-sm text-white/85" aria-live="polite">
          {status === "found" ? "Found it! Opening…" : message ?? "Point the camera at a Qalam QR label."}
        </p>
        {footer}
      </div>
    </div>
  );
}
