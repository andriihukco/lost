import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SwRegister from "@/components/SwRegister";
import MotionProvider from "@/components/MotionProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lost",
  description: "Спільний пошук схованих скарбів у реальному часі",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Lost", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: true,
  interactiveWidget: "resizes-content", // keyboard resizes the page, not the map shell
  themeColor: "#f4f7f1", // light only
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><MotionProvider>{children}</MotionProvider><SwRegister /></body>
    </html>
  );
}
