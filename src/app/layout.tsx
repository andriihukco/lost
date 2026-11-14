import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lost",
  description: "Спільний пошук схованих скарбів у реальному часі",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: true,
  interactiveWidget: "resizes-content", // keyboard resizes the page, not the map shell
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1613" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
