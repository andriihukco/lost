import { expect, test } from 'vitest';
import { detectInApp, openInBrowserHref } from '@/lib/inApp';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const TELEGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.8';
const TELEGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Telegram-Android/10.8.1';
const INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.33.109';
const FACEBOOK_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0]';
const IOS_WEBVIEW_NO_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

test('Safari and Chrome on iPhone are real browsers', () => {
  expect(detectInApp(IOS_SAFARI).inApp).toBe(false);
  expect(detectInApp(IOS_CHROME).inApp).toBe(false);
});
test('Chrome on Android is a real browser', () => {
  expect(detectInApp(ANDROID_CHROME).inApp).toBe(false);
});
test('Telegram on iPhone and Android is in-app', () => {
  expect(detectInApp(TELEGRAM_IOS)).toMatchObject({ inApp: true, name: 'Telegram', os: 'ios' });
  expect(detectInApp(TELEGRAM_ANDROID)).toMatchObject({ inApp: true, name: 'Telegram', os: 'android' });
});
test('Instagram and Facebook are in-app', () => {
  expect(detectInApp(INSTAGRAM_IOS).name).toBe('Instagram');
  expect(detectInApp(FACEBOOK_ANDROID).name).toBe('Facebook');
});
test('Viber, WhatsApp, Pinterest and the Google app are in-app', () => {
  expect(detectInApp(`${IOS_WEBVIEW_NO_SAFARI} Viber/20.1.0`).name).toBe('Viber');
  expect(detectInApp(`${IOS_WEBVIEW_NO_SAFARI} WhatsApp/2.24`).name).toBe('WhatsApp');
  expect(detectInApp(`${IOS_WEBVIEW_NO_SAFARI} Pinterest/for iOS`).name).toBe('Pinterest');
  expect(detectInApp(`${IOS_SAFARI} GSA/300.0.0 Mobile`).name).toBe('Google');
});
test('an iOS web view without Safari in its user agent is in-app', () => {
  expect(detectInApp(IOS_WEBVIEW_NO_SAFARI).inApp).toBe(true);
});
test('Android WebView is in-app even without a known app name', () => {
  const generic = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36';
  expect(detectInApp(generic).inApp).toBe(true);
});
test('empty user agent is treated as a normal browser', () => {
  expect(detectInApp('').inApp).toBe(false);
});
test('open-in-browser links: Safari on iOS, Chrome intent on Android', () => {
  expect(openInBrowserHref('ios', 'https://lost.example/path?x=1')).toBe('x-safari-https://lost.example/path?x=1');
  expect(openInBrowserHref('android', 'https://lost.example/path')).toBe(
    'intent://lost.example/path#Intent;scheme=https;package=com.android.chrome;end',
  );
});
