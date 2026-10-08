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
    id: "demo-palermo",
    title: "Departamento luminoso en Palermo",
    description:
      "Tres ambientes con balcon, cocina integrada y excelente conexion a transporte.",
    price: 125000,
    currency: "USD",
    photos: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    ],
    locationLabel: "Palermo, Ciudad de Buenos Aires",
    latitude: -34.5796,
    longitude: -58.4267,
    author: "demo",
    status: "published",
  },
  {
    id: "demo-nordelta",
    title: "Casa minimalista con jardin",
    description:
      "Casa familiar con espacios abiertos, galeria cubierta y jardin privado.",
    price: 280000,
    currency: "USD",
    photos: [
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80",
    ],
    locationLabel: "Nordelta, Tigre",
    latitude: -34.4087,
    longitude: -58.649,
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
