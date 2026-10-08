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
  status: "published" | "draft";
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
    title: "Quinta con arboleda y pileta",
    description:
      "Terreno amplio, galeria cubierta y entorno tranquilo a pocos minutos de la capital.",
    price: 145000,
    currency: "USD",
    photos: [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    ],
    locationLabel: "Valle Viejo, Catamarca",
    latitude: -28.5206,
    longitude: -65.7026,
    author: "demo",
    status: "published",
  },
  {
    id: "demo-fiambala",
    title: "Casa de descanso con vista al cerro",
    description:
      "Propiedad compacta con galeria, dos habitaciones y vista abierta hacia el paisaje.",
    price: 62000,
    currency: "USD",
    photos: [
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
    ],
    locationLabel: "Fiambala, Tinogasta",
    latitude: -27.6877,
    longitude: -67.6189,
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
    currency: String(record.currency ?? "ARS"),
    photos,
    locationLabel: String(record.locationLabel ?? ""),
    latitude: Number(record.latitude ?? 0),
    longitude: Number(record.longitude ?? 0),
    author: String(record.author ?? ""),
    status: record.status === "draft" ? "draft" : "published",
  };
}

export function formatPrice(property: PropertyListing) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: property.currency,
    maximumFractionDigits: 0,
  }).format(property.price);
}
