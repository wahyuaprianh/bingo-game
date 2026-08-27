import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans"
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono"
});

export const metadata: Metadata = {
  title: "Bingo Duel",
  description: "Bingo 2 pemain realtime — buat room, ajak teman, dan adu cepat garis bingo.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎱</text></svg>"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} ${spaceMono.variable}`}>
      <body className="font-sans antialiased bg-[#090a0f] text-[#f4f4f5]">{children}</body>
    </html>
  );
}
