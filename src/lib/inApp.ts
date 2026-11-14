// In-app browsers (Telegram, Instagram, Facebook, WebViews) keep their own session and often block
// location and the compass, so progress is lost there. Detect them from the user agent.

export type Os = 'ios' | 'android' | 'other';
export type InApp = { inApp: boolean; name: string | null; os: Os };

const NAMED: [RegExp, string][] = [
  [/Telegram/i, 'Telegram'],
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS|FBMD/i, 'Facebook'],
  [/Line\//i, 'LINE'],
  [/MicroMessenger/i, 'WeChat'],
  [/Twitter/i, 'X'],
  [/Snapchat/i, 'Snapchat'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/BytedanceWebview|musical_ly|TikTok/i, 'TikTok'],
  [/Viber/i, 'Viber'],
  [/WhatsApp/i, 'WhatsApp'],
  [/Pinterest/i, 'Pinterest'],
  [/KAKAOTALK/i, 'KakaoTalk'],
  [/Outlook/i, 'Outlook'],
  [/\bGSA\//, 'Google'], // the Google app's web view (Google Search App)
];

export function detectInApp(ua: string): InApp {
  const os: Os = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  for (const [re, name] of NAMED) {
    if (re.test(ua)) return { inApp: true, name, os };
  }
  // Android WebView marks itself with "; wv)". iOS web views omit the "Safari" token that real browsers send.
  if (os === 'android' && /; wv\)/.test(ua)) return { inApp: true, name: null, os };
  if (os === 'ios' && /AppleWebKit/.test(ua) && !/Safari/.test(ua)) return { inApp: true, name: null, os };
  return { inApp: false, name: null, os };
}

// A link that asks the phone to open this page in its own browser.
export function openInBrowserHref(os: Os, url: string): string {
  const u = new URL(url);
  const path = `${u.host}${u.pathname}${u.search}`;
  if (os === 'ios') return `x-safari-https://${path}${u.hash}`;
  if (os === 'android') return `intent://${path}#Intent;scheme=https;package=com.android.chrome;end`;
  return url;
}
