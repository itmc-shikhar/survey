import type { Metadata, Viewport } from "next";
import { Anek_Latin } from "next/font/google";
import "./globals.css";

const anek = Anek_Latin({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-anek", display: "swap" });

export const metadata: Metadata = {
  title: "Noticed — Everyone gets noticed.",
  description: "A new dating app for India where every profile gets a fair chance to be seen. Take the 3-minute survey and get early access.",
};

export const viewport: Viewport = {
  themeColor: "#C2410C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={anek.variable}>
      <body>{children}</body>
    </html>
  );
}
