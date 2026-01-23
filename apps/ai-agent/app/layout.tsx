import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoxPe AI - Voice-First Banking Assistant",
  description: "Your voice-controlled banking experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
