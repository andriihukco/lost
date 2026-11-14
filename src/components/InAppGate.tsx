'use client';

import { useState } from 'react';
import { openInBrowserHref, type InApp } from '@/lib/inApp';

// Shown inside Telegram, Instagram and other in-app browsers: asks the player to open the page in their own browser,
// where the session, location and compass are kept.
export default function InAppGate({ info, url, onContinue }: { info: InApp; url: string; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);
  const browser = info.os === 'ios' ? 'Safari' : info.os === 'android' ? 'Chrome' : 'браузері';
  const app = info.name ? `у ${info.name}` : 'в цьому застосунку';

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--page)] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <span className="grid h-32 w-32 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-6xl shadow-[0_6px_0_var(--green-deep)]">🧭</span>
        <h1 className="dl-title mt-8 text-[30px]">Відкрийте в {browser}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
          Lost не може зберегти ваш прогрес {app}: там не працюють геолокація і компас, а сесія живе лише в цьому вікні.
          Відкрийте сторінку в {browser}, і все працюватиме.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {info.os !== 'other' && (
          <a href={openInBrowserHref(info.os, url)} className="dl-btn text-center">
            Відкрити в {browser}
          </a>
        )}
        <ol className="dl-card flex flex-col gap-2 p-4 text-left text-[15px] leading-snug">
          <li><span className="font-bold">1.</span> У {info.name ?? 'застосунку'} натисніть меню «⋯» у правому верхньому куті.</li>
          <li><span className="font-bold">2.</span> Оберіть «Відкрити в {browser}» (або «Open in browser»).</li>
          {info.name === 'Telegram' && (
            <li className="text-[var(--muted)]">Щоб усі посилання відкривались у браузері: у налаштуваннях Telegram знайдіть пункт про внутрішній браузер і виберіть системний.</li>
          )}
        </ol>
        <button type="button" onClick={() => void copy()} className="dl-btn-secondary">
          {copied ? 'Посилання скопійовано' : 'Скопіювати посилання'}
        </button>
        <button type="button" onClick={onContinue} className="min-h-[44px] text-[15px] font-bold text-[var(--muted)]">
          Продовжити тут (прогрес може не зберегтися)
        </button>
      </div>
    </div>
  );
}
