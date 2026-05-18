import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Central Comercial IA EAD",
  description: "Gerador de abordagens comerciais para consultores EAD"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
