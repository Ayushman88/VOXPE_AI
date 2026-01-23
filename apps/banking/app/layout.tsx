import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dummy Bank - Secure Banking",
  description: "Realistic dummy banking interface",
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
