import type { RecordModel } from "pocketbase";

import { pocketbaseUrl } from "./config";

export type PropertyListing = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  photos: string[];
  locationLabel: string;
  latitude: number;
  longitude: number;
  author: string;
  status: "published" | "draft" | "sold";
};

export const demoProperties: PropertyListing[] = [
  {
    id: "demo-capital",
    title: "Casa luminosa cerca del centro",
    description:
      "Casa familiar con patio, tres dormitorios y acceso rapido al centro catamarqueno.",
    price: 87000,
    currency: "USD",
    photos: [
      "https://images.unsplash.com/photo-1560184897-ae75f418493e?auto=format&fit=crop&w=1200&q=80",
    ],
    locationLabel: "San Fernando del Valle de Catamarca",
    latitude: -28.4696,
    longitude: -65.7852,
    author: "demo",
    status: "published",
  },
  {
    id: "demo-valle-viejo",
    title: "Quinta camino a Valle Viejo",
    description:
      "Terreno amplio, galeria cubierta y entorno tranquilo a pocos minutos de la capital.",
    price: 145000,
    currency: "USD",
    photos: [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    ],
    locationLabel: "Valle Viejo, Gran Catamarca",
    latitude: -28.5065,
    longitude: -65.7231,
    author: "demo",
    status: "sold",
  },
  {
    id: "demo-zona-norte",
    title: "Duplex en zona norte",
    description:
      "Duplex moderno con cochera, dos dormitorios y salida rapida hacia Avenida Mexico.",
    price: 76000,
    currency: "USD",
    photos: [
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
    ],
    locationLabel: "Zona norte, San Fernando del Valle de Catamarca",
    latitude: -28.4482,
    longitude: -65.7757,
    author: "demo",
    status: "published",
  },
];

export function propertyFromRecord(record: RecordModel): PropertyListing {
  const photos = Array.isArray(record.photos)
    ? record.photos.map((photo: string) =>
        `${pocketbaseUrl}/api/files/${record.collectionId}/${record.id}/${photo}`,
      )
    : [];

  return {
    id: record.id,
    title: String(record.title ?? ""),
    description: String(record.description ?? ""),
    price: Number(record.price ?? 0),
    currency: String(record.currency ?? "USD"),
    photos,
    locationLabel: String(record.locationLabel ?? ""),
    latitude: Number(record.latitude ?? 0),
    longitude: Number(record.longitude ?? 0),
    author: String(record.author ?? ""),
    status:
      record.status === "draft" || record.status === "sold"
        ? record.status
        : "published",
  };
}

export function formatPrice(property: PropertyListing) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: property.currency,
    maximumFractionDigits: 0,
  }).format(property.price);
}
