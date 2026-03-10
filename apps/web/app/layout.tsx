import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tambola",
  description: "Real-time Tambola multiplayer"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
