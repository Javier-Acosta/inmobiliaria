"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthModel } from "pocketbase";

import { defaultCurrency } from "@/lib/config";
import { getPocketBase } from "@/lib/pocketbase";
import {
  demoProperties,
  formatPrice,
  propertyFromRecord,
  type PropertyListing,
} from "@/lib/properties";

type FormState = {
  id?: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
  photos: FileList | null;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  price: "",
  currency: defaultCurrency,
  locationLabel: "",
  latitude: "",
  longitude: "",
  photos: null,
};

function modelName(model: AuthModel) {
  if (!model) return "";
  const data = model as { name?: string; email?: string };
  return data.name || data.email || "Usuario";
}

export default function PropertyApp() {
  const pb = useMemo(() => getPocketBase(), []);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [selected, setSelected] = useState<PropertyListing | null>(null);
  const [user, setUser] = useState<AuthModel>(() => pb.authStore.model);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await pb.collection("properties").getFullList({
        filter: 'status = "published"',
        sort: "-created",
      });
      const items = records.map(propertyFromRecord);
      setProperties(items.length ? items : demoProperties);
      setStatus("");
    } catch {
      setProperties(demoProperties);
      setStatus(
        "Mostrando propiedades de ejemplo. Conecta PocketBase para ver publicaciones reales.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    void Promise.resolve().then(loadProperties);

    return pb.authStore.onChange(() => {
      setUser(pb.authStore.model);
    });
  }, [loadProperties, pb]);

  async function loginWithGoogle() {
    setStatus("Abriendo login con Google...");
    try {
      await pb.collection("users").authWithOAuth2({ provider: "google" });
      setUser(pb.authStore.model);
      setStatus("Sesion iniciada.");
    } catch {
      setStatus(
        "No se pudo iniciar sesion. Revisa la configuracion OAuth de PocketBase.",
      );
    }
  }

  function logout() {
    pb.authStore.clear();
    setUser(null);
    setForm(emptyForm);
    setStatus("Sesion cerrada.");
  }

  function editProperty(property: PropertyListing) {
    if (!user) {
      setStatus("Inicia sesion con Google para editar publicaciones.");
      return;
    }

    if (property.author && property.author !== user.id) {
      setStatus("Solo el autor puede editar esta propiedad.");
      return;
    }

    setForm({
      id: property.id,
      title: property.title,
      description: property.description,
      price: String(property.price),
      currency: property.currency,
      locationLabel: property.locationLabel,
      latitude: String(property.latitude),
      longitude: String(property.longitude),
      photos: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setStatus("Inicia sesion con Google para publicar.");
      return;
    }

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.price ||
      !form.locationLabel.trim() ||
      !form.latitude ||
      !form.longitude
    ) {
      setStatus("Completa titulo, descripcion, precio y ubicacion.");
      return;
    }

    const payload = new FormData();
    payload.set("title", form.title.trim());
    payload.set("description", form.description.trim());
    payload.set("price", form.price);
    payload.set("currency", form.currency || defaultCurrency);
    payload.set("locationLabel", form.locationLabel.trim());
    payload.set("latitude", form.latitude);
    payload.set("longitude", form.longitude);
    payload.set("status", "published");
    payload.set("author", user.id);

    Array.from(form.photos ?? []).forEach((file) => {
      payload.append("photos", file);
    });

    try {
      if (form.id) {
        await pb.collection("properties").update(form.id, payload);
        setStatus("Cambios guardados.");
      } else {
        await pb.collection("properties").create(payload);
        setStatus("Propiedad publicada.");
      }
      setForm(emptyForm);
      await loadProperties();
    } catch {
      setStatus(
        "No se pudo guardar. Revisa PocketBase, las reglas de acceso y los campos requeridos.",
      );
    }
  }

  async function deleteProperty(property: PropertyListing) {
    if (!user) {
      setStatus("Inicia sesion con Google para eliminar.");
      return;
    }

    if (property.author && property.author !== user.id) {
      setStatus("Solo el autor puede eliminar esta propiedad.");
      return;
    }

    if (!window.confirm(`Eliminar "${property.title}"?`)) return;

    try {
      await pb.collection("properties").delete(property.id);
      setSelected(null);
      setStatus("Propiedad eliminada.");
      await loadProperties();
    } catch {
      setStatus("No se pudo eliminar la propiedad.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#171717]">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-6 border-b border-black/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#6e7d5b]">
              Inmobiliaria
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Propiedades claras, ubicacion exacta y publicacion simple.
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <span className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm">
                  {modelName(user)}
                </span>
                <button
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white"
                  onClick={logout}
                  type="button"
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white"
                onClick={loginWithGoogle}
                type="button"
              >
                Login con Google
              </button>
            )}
          </div>
        </header>

        {status ? (
          <p className="rounded-md border border-black/10 bg-white px-4 py-3 text-sm text-[#4d4d4d]">
            {status}
          </p>
        ) : null}

        <section className="grid gap-8 lg:grid-cols-[380px_1fr]">
          <form
            className="h-fit rounded-md border border-black/10 bg-white p-5 shadow-sm"
            onSubmit={submitProperty}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {form.id ? "Editar propiedad" : "Publicar propiedad"}
              </h2>
              {form.id ? (
                <button
                  className="text-sm text-[#6e7d5b]"
                  onClick={() => setForm(emptyForm)}
                  type="button"
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1 text-sm font-medium">
                Titulo
                <input
                  className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  value={form.title}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Descripcion
                <textarea
                  className="min-h-28 rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  value={form.description}
                />
              </label>
              <div className="grid grid-cols-[1fr_92px] gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  Precio
                  <input
                    className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                    type="number"
                    value={form.price}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Moneda
                  <input
                    className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        currency: event.target.value.toUpperCase(),
                      }))
                    }
                    value={form.currency}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium">
                Ubicacion
                <input
                  className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      locationLabel: event.target.value,
                    }))
                  }
                  placeholder="Barrio, ciudad o direccion"
                  value={form.locationLabel}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm font-medium">
                  Latitud
                  <input
                    className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        latitude: event.target.value,
                      }))
                    }
                    type="number"
                    value={form.latitude}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Longitud
                  <input
                    className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        longitude: event.target.value,
                      }))
                    }
                    type="number"
                    value={form.longitude}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium">
                Fotos
                <input
                  accept="image/*"
                  className="rounded-md border border-dashed border-black/20 px-3 py-3 font-normal"
                  multiple
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      photos: event.target.files,
                    }))
                  }
                  type="file"
                />
              </label>
              <button
                className="rounded-md bg-[#6e7d5b] px-4 py-3 text-sm font-semibold text-white"
                type="submit"
              >
                {form.id ? "Guardar cambios" : "Publicar"}
              </button>
            </div>
          </form>

          <section className="grid gap-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Propiedades</h2>
                <p className="text-sm text-black/60">
                  Fotos, precio y ubicacion en una vista simple.
                </p>
              </div>
              <span className="text-sm text-black/50">
                {isLoading ? "Cargando..." : `${properties.length} publicadas`}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {properties.map((property) => (
                <article
                  className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
                  key={property.id}
                >
                  <button
                    className="block w-full text-left"
                    onClick={() => setSelected(property)}
                    type="button"
                  >
                    <div className="relative aspect-[4/3] bg-[#e8e2d8]">
                      {property.photos[0] ? (
                        <Image
                          alt={property.title}
                          className="object-cover"
                          fill
                          sizes="(min-width: 1280px) 280px, (min-width: 768px) 50vw, 100vw"
                          src={property.photos[0]}
                          unoptimized={property.photos[0].startsWith("http")}
                        />
                      ) : null}
                    </div>
                    <div className="grid gap-2 p-4">
                      <p className="text-lg font-semibold">
                        {formatPrice(property)}
                      </p>
                      <h3 className="font-medium">{property.title}</h3>
                      <p className="line-clamp-2 text-sm text-black/60">
                        {property.description}
                      </p>
                      <p className="text-sm text-[#6e7d5b]">
                        {property.locationLabel}
                      </p>
                    </div>
                  </button>
                  <div className="flex gap-2 border-t border-black/10 p-3">
                    <button
                      className="rounded-md border border-black/10 px-3 py-2 text-sm"
                      onClick={() => editProperty(property)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-black/10 px-3 py-2 text-sm text-red-700"
                      onClick={() => deleteProperty(property)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        {selected ? (
          <section className="rounded-md border border-black/10 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#6e7d5b]">
                  {selected.locationLabel}
                </p>
                <h2 className="mt-1 text-3xl font-semibold">
                  {selected.title}
                </h2>
                <p className="mt-2 text-xl font-semibold">
                  {formatPrice(selected)}
                </p>
              </div>
              <button
                className="rounded-full border border-black/10 px-4 py-2 text-sm"
                onClick={() => setSelected(null)}
                type="button"
              >
                Cerrar
              </button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
              <div className="grid gap-4">
                <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-[#e8e2d8]">
                  {selected.photos[0] ? (
                    <Image
                      alt={selected.title}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1024px) 60vw, 100vw"
                      src={selected.photos[0]}
                      unoptimized={selected.photos[0].startsWith("http")}
                    />
                  ) : null}
                </div>
                <p className="leading-7 text-black/70">{selected.description}</p>
              </div>
              <div className="overflow-hidden rounded-md border border-black/10 bg-[#f7f5f0]">
                {Number.isFinite(selected.latitude) &&
                Number.isFinite(selected.longitude) ? (
                  <iframe
                    className="h-[360px] w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${selected.latitude},${selected.longitude}&z=15&output=embed`}
                    title={`Mapa de ${selected.title}`}
                  />
                ) : (
                  <div className="grid h-[360px] place-items-center p-6 text-center text-sm text-black/60">
                    No se pudo cargar el mapa. La ubicacion indicada es{" "}
                    {selected.locationLabel}.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
