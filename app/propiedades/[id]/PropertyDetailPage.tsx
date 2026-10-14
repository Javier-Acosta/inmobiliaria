"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import FavoriteButton from "@/app/components/FavoriteButton";
import { useFavorites } from "@/lib/use-favorites";

import { adminEmails } from "@/lib/config";
import { getPocketBase } from "@/lib/pocketbase";
import {
  formatPrice,
  propertyFromRecord,
  type PropertyListing,
} from "@/lib/properties";

function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

function displayContactPhone(phone: string) {
  const digits = phoneDigits(phone);

  if (digits.startsWith("54") && digits.length > 10) {
    return digits.slice(2);
  }

  return digits || phone;
}

function whatsappDigits(phone: string) {
  const digits = phoneDigits(phone);

  if (digits.length === 10) {
    return `54${digits}`;
  }

  return digits;
}

function phoneHref(phone: string) {
  const digits = phoneDigits(phone);

  if (digits.length === 10) {
    return `+54${digits}`;
  }

  return digits ? `+${digits}` : "";
}

function propertyPublicUrl(property: PropertyListing) {
  if (typeof window === "undefined") return `/propiedades/${property.id}`;

  return `${window.location.origin}/propiedades/${property.id}`;
}

function whatsappUrl(property: PropertyListing) {
  const digits = whatsappDigits(property.contactPhone);
  const url = propertyPublicUrl(property);
  const photo = property.photos[0] ? `\nFoto: ${property.photos[0]}` : "";
  const message = `Hola, quiero consultar por ${property.title} en Venta\nPublicacion: ${url}${photo}`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function googleMapsUrl(property: PropertyListing) {
  return `https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`;
}

function reportUrl(property: PropertyListing) {
  const subject = `Reporte de publicación: ${property.title}`;
  const body = `Quiero reportar esta publicación.\n\n${propertyPublicUrl(property)}\n\nMotivo:`;
  return `mailto:${adminEmails[0]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.left = "-9999px";
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function SoldRibbon() {
  return (
    <span className="absolute right-[-36px] top-5 z-10 rotate-45 bg-red-700 px-12 py-1 text-xs font-bold tracking-[0.16em] text-white shadow-md">
      VENDIDO
    </span>
  );
}

export default function PropertyDetailPage({ id }: { id: string }) {
  const { favoriteIds, toggleFavorite, favoriteError } = useFavorites();
  const pb = useMemo(() => getPocketBase(), []);
  const [property, setProperty] = useState<PropertyListing | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [status, setStatus] = useState("Cargando publicacion...");
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProperty() {
      try {
        const record = await pb.collection("properties").getOne(id);
        if (cancelled) return;
        setProperty(propertyFromRecord(record));
        setSelectedPhoto(0);
        setStatus("");
      } catch {
        if (cancelled) return;
        setStatus("No se pudo abrir esta publicacion.");
      }
    }

    void loadProperty();

    return () => {
      cancelled = true;
    };
  }, [id, pb]);

  async function shareProperty() {
    if (!property || typeof window === "undefined") return;

    const url = window.location.href;
    const text = `${property.title} - ${formatPrice(property)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: property.title,
          text,
          url,
        });
        setShareStatus("Link compartido.");
        return;
      }

      await copyTextToClipboard(url);
      setShareStatus("Link copiado.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setShareStatus("No se pudo compartir el link.");
    }
  }

  const currentPhoto = property?.photos[selectedPhoto] ?? property?.photos[0];

  return (
    <main className="min-h-screen bg-[#f7f5f0] pb-24 text-[#171717] lg:pb-0">
      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
            href="/"
          >
            Volver
          </Link>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#6e7d5b]">
            Inmobiliaria
          </p>
        </div>

        {status ? (
          <p className="rounded-md border border-black/10 bg-white px-4 py-3 text-sm text-black/60">
            {status}
          </p>
        ) : null}

        {property ? (
          <article className="grid gap-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              <div className="grid gap-4">
                <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-[#e8e2d8] shadow-sm">
                  {property.status === "sold" ? <SoldRibbon /> : null}
                  {currentPhoto ? (
                    <Image
                      alt={property.title}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1024px) 60vw, 100vw"
                      src={currentPhoto}
                      unoptimized={currentPhoto.startsWith("http")}
                      priority
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-center text-black/50">
                      Sin foto cargada
                    </div>
                  )}
                </div>

                {property.photos.length > 1 ? (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {property.photos.map((photo, index) => (
                      <button
                        aria-label={`Ver foto ${index + 1}`}
                        className={`relative aspect-[4/3] overflow-hidden rounded-md border bg-[#e8e2d8] ${
                          selectedPhoto === index
                            ? "border-[#6e7d5b] ring-2 ring-[#6e7d5b]/30"
                            : "border-black/10"
                        }`}
                        key={photo}
                        onClick={() => setSelectedPhoto(index)}
                        type="button"
                      >
                        <Image
                          alt={`${property.title} foto ${index + 1}`}
                          className="object-cover"
                          fill
                          sizes="120px"
                          src={photo}
                          unoptimized={photo.startsWith("http")}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                <section className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-semibold">Descripcion</h2>
                  <p className="mt-3 leading-7 text-black/70">
                    {property.description}
                  </p>
                </section>

                <section className="grid gap-3 rounded-md border border-black/10 bg-white p-5 shadow-sm sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-black/45">Ubicacion</p>
                    <p className="mt-1 font-semibold">{property.locationLabel}</p>
                  </div>
                  <div>
                    <p className="text-sm text-black/45">Precio</p>
                    <p className="mt-1 font-semibold">{formatPrice(property)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-black/45">Contacto</p>
                    <p className="mt-1 font-semibold">
                      {property.contactPhone
                        ? displayContactPhone(property.contactPhone)
                        : "No publicado"}
                    </p>
                  </div>
                </section>
              </div>

              <aside className="grid content-start gap-4 lg:sticky lg:top-6">
                <div className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-black/60">Favoritos</span>
                    <FavoriteButton isFavorite={favoriteIds.includes(property.id)} onToggle={() => toggleFavorite(property.id)} />
                  </div>
                  {favoriteError ? <p className="mb-3 text-sm text-red-700" role="alert">{favoriteError}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#edf2e7] px-3 py-1 text-xs font-semibold text-[#4d5e39]">
                      {property.propertyType}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        property.status === "sold"
                          ? "bg-red-50 text-red-700"
                          : "bg-[#f7f5f0] text-black/60"
                      }`}
                    >
                      {property.status === "sold" ? "Vendido" : "Disponible"}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-medium text-[#6e7d5b]">
                    {property.locationLabel}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold">
                    {property.title}
                  </h1>
                  <p className="mt-3 text-2xl font-semibold">
                    {formatPrice(property)}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-[#f7f5f0] p-3">
                      <p className="text-black/45">Tipo</p>
                      <p className="mt-1 font-semibold">{property.propertyType}</p>
                    </div>
                    <div className="rounded-md bg-[#f7f5f0] p-3">
                      <p className="text-black/45">Estado</p>
                      <p className="mt-1 font-semibold">
                        {property.status === "sold" ? "Vendido" : "Disponible"}
                      </p>
                    </div>
                  </div>
                </div>

                {property.contactPhone ? (
                  <div className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold">Contactar</h2>
                    <p className="mt-2 text-sm text-black/60">
                      Contacto: {displayContactPhone(property.contactPhone)}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      <a
                        className="rounded-md bg-[#25d366] px-4 py-3 text-center text-sm font-semibold text-white"
                        href={whatsappUrl(property)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        WhatsApp
                      </a>
                      <a
                        className="rounded-md border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold"
                        href={`tel:${phoneHref(property.contactPhone)}`}
                      >
                        Llamar
                      </a>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
                  <button
                    className="w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white"
                    onClick={shareProperty}
                    type="button"
                  >
                    Compartir publicacion
                  </button>
                  {adminEmails[0] && property.author !== "demo" ? (
                    <a
                      className="mt-2 block w-full rounded-md border border-black/10 px-4 py-3 text-center text-sm font-semibold"
                      href={reportUrl(property)}
                    >
                      Reportar publicación
                    </a>
                  ) : null}
                  {shareStatus ? (
                    <p className="mt-3 text-center text-sm text-black/60">
                      {shareStatus}
                    </p>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-black/10 p-4">
                    <div>
                      <h2 className="font-semibold">Ubicacion exacta</h2>
                      <p className="mt-1 text-sm text-black/50">
                        {property.locationLabel}
                      </p>
                    </div>
                    {Number.isFinite(property.latitude) &&
                    Number.isFinite(property.longitude) ? (
                      <a
                        className="shrink-0 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold"
                        href={googleMapsUrl(property)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir en Maps
                      </a>
                    ) : null}
                  </div>
                  {Number.isFinite(property.latitude) &&
                  Number.isFinite(property.longitude) ? (
                    <iframe
                      className="h-[320px] w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`}
                      title={`Mapa de ${property.title}`}
                    />
                  ) : (
                    <div className="grid h-[320px] place-items-center p-6 text-center text-sm text-black/60">
                      No se pudo cargar el mapa.
                    </div>
                  )}
                </div>
              </aside>
            </div>

            {property.contactPhone ? (
              <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-black/10 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
                <a
                  className="rounded-md bg-[#25d366] px-4 py-3 text-center text-sm font-semibold text-white"
                  href={whatsappUrl(property)}
                  rel="noreferrer"
                  target="_blank"
                >
                  WhatsApp
                </a>
                <a
                  className="rounded-md border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold"
                  href={`tel:${phoneHref(property.contactPhone)}`}
                >
                  Llamar
                </a>
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    </main>
  );
}
