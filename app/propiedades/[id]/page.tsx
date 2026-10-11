import type { Metadata } from "next";

import { appUrl, pocketbaseUrl } from "@/lib/config";
import { formatPrice, propertyFromRecord, type PropertyListing } from "@/lib/properties";

import PropertyDetailPage from "./PropertyDetailPage";

export const instant = false;

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getPropertyForMetadata(id: string): Promise<PropertyListing | null> {
  try {
    const response = await fetch(
      `${pocketbaseUrl}/api/collections/properties/records/${id}`,
      {
        next: { revalidate: 300 },
      },
    );

    if (!response.ok) return null;

    return propertyFromRecord(await response.json());
  } catch {
    return null;
  }
}

function metadataDescription(property: PropertyListing) {
  const text = `${formatPrice(property)} · ${property.propertyType} en ${property.locationLabel}. ${property.description}`;
  return text.length > 155 ? `${text.slice(0, 152)}...` : text;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const property = await getPropertyForMetadata(id);

  if (!property) {
    return {
      title: "Propiedad no encontrada",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${property.title} - ${formatPrice(property)}`;
  const description = metadataDescription(property);
  const url = `${appUrl}/propiedades/${property.id}`;
  const images = property.photos[0] ? [property.photos[0]] : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      images,
      type: "article",
      url,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}

export default async function Page({
  params,
}: PageProps) {
  const { id } = await params;

  return <PropertyDetailPage id={id} />;
}
