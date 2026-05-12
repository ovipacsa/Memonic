import type { Metadata } from "next";
import { Monoton, Audiowide, VT323, Space_Mono } from "next/font/google";
import "./globals.css";

const monoton = Monoton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-monoton",
  display: "swap"
});

const audiowide = Audiowide({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-audiowide",
  display: "swap"
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
  display: "swap"
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Memonic — A signal across the cosmos",
  description: "A social network for the small, remarkable corner of the universe you actually inhabit. Hosted in the European Union. Built by Mnemonic Studio."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${monoton.variable} ${audiowide.variable} ${vt323.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
