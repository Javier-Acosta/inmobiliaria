import type { Metadata } from "next";
import { appUrl } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Propiedades en Venta Catamarca",
    template: "%s | Inmobiliaria Catamarca",
  },
  description:
    "Explora propiedades en venta en Catamarca con fotos, precio, WhatsApp y ubicacion exacta en el mapa.",
  openGraph: {
    title: "Propiedades en Venta Catamarca",
    description:
      "Casas, departamentos, terrenos y quintas en Catamarca con fotos, precio y ubicacion.",
    locale: "es_AR",
    siteName: "Inmobiliaria Catamarca",
    type: "website",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Propiedades en Venta Catamarca",
    description:
      "Explora propiedades en venta en Catamarca con fotos, precio y ubicacion exacta.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
