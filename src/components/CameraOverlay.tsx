'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { clampOpacity, OVERLAY_DEFAULT } from '@/lib/cameraOverlay';

// Full-screen rear camera with the hint photo laid over it. The player slides the opacity and walks
// until the photo lines up with the real spot. Nothing is recorded or uploaded.
export default function CameraOverlay({ photoUrls, onClose }: { photoUrls: string[]; onClose: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [opacity, setOpacity] = useState(OVERLAY_DEFAULT);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
          setReady(true);
        }
      } catch {
        setError('Камера недоступна. Дозвольте доступ до камери в налаштуваннях браузера.');
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const photo = photoUrls[index] ?? null;

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <video ref={video} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" aria-label="Камера" />
      {photo && ready && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="Підказка поверх камери" style={{ opacity: opacity }} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button type="button" onClick={onClose} className="grid h-11 min-w-[44px] place-items-center rounded-full bg-white/90 px-3 text-[15px] font-bold text-[var(--ink)]">
          Закрити
        </button>
        <div className="flex items-center gap-2">
          {photoUrls.length > 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % photoUrls.length)}
              className="grid h-11 min-w-[44px] place-items-center rounded-full bg-white/90 px-3 text-[15px] font-bold text-[var(--ink)]"
            >
              Фото {index + 1}/{photoUrls.length}
            </button>
          )}
          {photo && (
            <a
              href={photo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Відкрити фото повністю у новій вкладці"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[var(--ink)]"
            >
              <Icon name="open_in_new" size={22} />
            </a>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 text-center text-[16px] font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      {photo && ready && (
        <div className="absolute inset-x-0 bottom-0 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <label className="flex flex-col gap-2 rounded-2xl bg-white p-4 text-[var(--ink)]">
            <span className="text-[13px] font-bold uppercase tracking-wider text-[var(--muted)]">Прозорість фото</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(clampOpacity(Number(e.target.value)))}
              className="h-11 w-full accent-[var(--green)]"
            />
          </label>
        </div>
      )}
    </div>
  );
}
