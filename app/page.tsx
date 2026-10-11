import type { Metadata } from "next";

import PropertyApp from "./components/PropertyApp";

export const metadata: Metadata = {
  title: "Propiedades en Venta Catamarca",
  description:
    "Busca casas, departamentos, terrenos y quintas en Catamarca. Publica la tuya con fotos, precio, WhatsApp y ubicacion exacta.",
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return <PropertyApp />;
}
