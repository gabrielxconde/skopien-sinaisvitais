"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  streamUrl: string;
}

export function CameraPlayer({ streamUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hlsUnsupported, setHlsUnsupported] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    async function setup() {
      const video = videoRef.current;
      if (!video || destroyed) return;

      const Hls = (await import("hls.js")).default;

      if (Hls.isSupported()) {
        const hls = new Hls({
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          manifestLoadingTimeOut: 8000,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            hls.destroy();
            if (!destroyed) reconnectTimer = setTimeout(setup, 5000);
          }
        });

        return () => hls.destroy();
      }

      const v = videoRef.current;
      if (v?.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = streamUrl;
        v.play().catch(() => {});
      } else {
        setHlsUnsupported(true);
      }
    }

    setup();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
    };
  }, [streamUrl]);

  if (hlsUnsupported) {
    return (
      <div
        className="w-full h-full flex items-center justify-center rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--muted)" }}>HLS não suportado</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      muted
      playsInline
    />
  );
}
