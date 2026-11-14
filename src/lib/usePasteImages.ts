'use client';

import { useEffect, useRef } from 'react';
import { imagesFromClipboard } from '@/lib/clipboardImages';

// Calls onImages with the image files pasted anywhere on the page (Ctrl+V / ⌘V). A paste with no image is left alone,
// so pasting text into a field still works.
export function usePasteImages(onImages: (files: File[]) => void, enabled = true) {
  const latest = useRef(onImages);
  useEffect(() => {
    latest.current = onImages;
  }, [onImages]);

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = imagesFromClipboard(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      latest.current(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [enabled]);
}
