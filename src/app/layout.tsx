import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idea Synthesizer",
  description: "Local research cockpit for startup opportunity synthesis."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
