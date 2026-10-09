"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getPocketBase } from "@/lib/pocketbase";
import {
  demoProperties,
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

function whatsappUrl(property: PropertyListing) {
  const digits = whatsappDigits(property.contactPhone);
  const message = `Hola, quiero consultar por ${property.title}`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function SoldRibbon() {
  return (
    <span className="absolute right-[-36px] top-5 z-10 rotate-45 bg-red-700 px-12 py-1 text-xs font-bold tracking-[0.16em] text-white shadow-md">
      VENDIDO
    </span>
  );
}

export default function PropertyDetailPage({ id }: { id: string }) {
  const pb = useMemo(() => getPocketBase(), []);
  const [property, setProperty] = useState<PropertyListing | null>(null);
  const [status, setStatus] = useState("Cargando publicacion...");

  useEffect(() => {
    let cancelled = false;

    async function loadProperty() {
      const demo = demoProperties.find((item) => item.id === id);

      if (demo) {
        setProperty(demo);
        setStatus("");
        return;
      }

      try {
        const record = await pb.collection("properties").getOne(id);
        if (cancelled) return;
        setProperty(propertyFromRecord(record));
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

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#171717]">
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
          <article className="grid gap-6 rounded-md border border-black/10 bg-white p-5 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
              <div className="grid gap-4">
                <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-[#e8e2d8]">
                  {property.status === "sold" ? <SoldRibbon /> : null}
                  {property.photos[0] ? (
                    <Image
                      alt={property.title}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1024px) 60vw, 100vw"
                      src={property.photos[0]}
                      unoptimized={property.photos[0].startsWith("http")}
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-center text-black/50">
                      Sin foto cargada
                    </div>
                  )}
                </div>
                <p className="leading-7 text-black/70">{property.description}</p>
              </div>

              <aside className="grid content-start gap-4">
                <div>
                  <p className="text-sm font-medium text-[#6e7d5b]">
                    {property.locationLabel}
                  </p>
                  <p className="mt-2 text-sm font-medium text-black/50">
                    {property.propertyType}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold">
                    {property.title}
                  </h1>
                  <p className="mt-3 text-2xl font-semibold">
                    {formatPrice(property)}
                  </p>
                </div>

                {property.contactPhone ? (
                  <div className="rounded-md border border-black/10 bg-[#f7f5f0] p-4">
                    <p className="text-sm text-black/60">
                      Contacto: {displayContactPhone(property.contactPhone)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        className="rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white"
                        href={whatsappUrl(property)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        WhatsApp
                      </a>
                      <a
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                        href={`tel:${phoneHref(property.contactPhone)}`}
                      >
                        Llamar
                      </a>
                    </div>
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-md border border-black/10 bg-[#f7f5f0]">
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
          </article>
        ) : null}
      </section>
    </main>
  );
}
