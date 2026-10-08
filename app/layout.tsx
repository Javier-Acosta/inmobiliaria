import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inmobiliaria",
  description: "Publica y explora propiedades con fotos, precio y ubicacion exacta.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
