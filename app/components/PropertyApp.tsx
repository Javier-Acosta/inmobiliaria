"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthModel } from "pocketbase";

import { defaultCurrency, googleMapsApiKey } from "@/lib/config";
import { getPocketBase } from "@/lib/pocketbase";
import {
  demoProperties,
  formatPrice,
  propertyFromRecord,
  type PropertyListing,
} from "@/lib/properties";

type FormState = {
  id?: string;
  status?: PropertyListing["status"];
  title: string;
  description: string;
  price: string;
  currency: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
  photos: File[];
};

const emptyForm: FormState = {
  title: "",
  description: "",
  price: "",
  currency: defaultCurrency,
  locationLabel: "",
  latitude: "",
  longitude: "",
  photos: [],
};

const maxPhotoDimension = 1600;
const maxCompressedPhotoBytes = 1_600_000;
const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo comprimir la imagen."));
      },
      type,
      quality,
    );
  });
}

async function compressPhoto(file: File) {
  const normalizedName = file.name.toLowerCase();
  const hasSupportedExtension = imageExtensions.some((extension) =>
    normalizedName.endsWith(extension),
  );

  if (file.type && !imageMimeTypes.includes(file.type)) {
    throw new Error(
      `${file.name} no es compatible. Usa fotos JPG/JPEG, PNG o WEBP.`,
    );
  }

  if (!file.type && !hasSupportedExtension) {
    throw new Error(
      `${file.name} no tiene un formato reconocido. En iPhone elegi fotos JPEG, no HEIC.`,
    );
  }

  const image = await loadImage(file);
  const scale = Math.min(
    1,
    maxPhotoDimension / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("El navegador no pudo preparar la compresion de imagen.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  let outputType =
    file.type === "image/png" || normalizedName.endsWith(".png")
      ? "image/png"
      : "image/jpeg";
  let quality = outputType === "image/png" ? 0.92 : 0.82;
  let blob = await canvasToBlob(canvas, outputType, quality);

  while (blob.size > maxCompressedPhotoBytes && quality > 0.45) {
    outputType = "image/jpeg";
    quality -= 0.08;
    blob = await canvasToBlob(canvas, outputType, quality);
  }

  if (blob.size > maxCompressedPhotoBytes) {
    throw new Error(
      `${file.name} sigue pesando ${formatBytes(
        blob.size,
      )}. Proba con una foto mas chica.`,
    );
  }

  const extension = outputType === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "propiedad";
  return new File([blob], `${baseName}.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}

function SoldRibbon() {
  return (
    <span className="absolute right-[-34px] top-4 z-10 rotate-45 bg-red-700 px-10 py-1 text-xs font-bold tracking-[0.16em] text-white shadow-md">
      VENDIDO
    </span>
  );
}

const fallbackBounds = {
  north: -28.27,
  south: -28.67,
  west: -65.95,
  east: -65.58,
};

const granCatamarcaMapUrl =
  "https://maps.google.com/maps?q=Gran%20Catamarca%2C%20Catamarca%2C%20Argentina&z=11&output=embed";
const granCatamarcaCenter = { lat: -28.485, lng: -65.74 };

type GoogleMap = {
  addListener: (eventName: string, callback: (event: GoogleMapClickEvent) => void) => {
    remove: () => void;
  };
};

type GoogleMapClickEvent = {
  latLng?: {
    lat: () => number;
    lng: () => number;
  };
};

type GoogleMapsRuntime = {
  maps: {
    LatLng: new (lat: number, lng: number) => unknown;
    Map: new (
      element: HTMLElement,
      options: {
        center: { lat: number; lng: number };
        clickableIcons?: boolean;
        fullscreenControl?: boolean;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        zoom: number;
      },
    ) => GoogleMap;
    OverlayView: new () => {
      draw: () => void;
      getPanes: () => { overlayMouseTarget?: HTMLElement } | null;
      getProjection: () => {
        fromLatLngToDivPixel: (latLng: unknown) => { x: number; y: number } | null;
      } | null;
      onAdd: () => void;
      onRemove: () => void;
      setMap: (map: GoogleMap | null) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsRuntime;
    inmobiliariaGoogleMapsPromise?: Promise<GoogleMapsRuntime>;
  }
}

function modelName(model: AuthModel) {
  if (!model) return "";
  const data = model as { name?: string; email?: string };
  return data.name || data.email || "Usuario";
}

function mapPosition(property: PropertyListing) {
  const rawLeft =
    ((property.longitude - fallbackBounds.west) /
      (fallbackBounds.east - fallbackBounds.west)) *
    100;
  const rawTop =
    ((fallbackBounds.north - property.latitude) /
      (fallbackBounds.north - fallbackBounds.south)) *
    100;

  return {
    left: `${Math.min(88, Math.max(8, rawLeft))}%`,
    top: `${Math.min(84, Math.max(12, rawTop))}%`,
  };
}

function loadGoogleMaps() {
  if (!googleMapsApiKey) return Promise.resolve(null);
  if (window.google) return Promise.resolve(window.google);
  if (window.inmobiliariaGoogleMapsPromise) {
    return window.inmobiliariaGoogleMapsPromise;
  }

  window.inmobiliariaGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      googleMapsApiKey,
    )}&v=weekly`;
    script.onload = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google Maps no quedo disponible."));
    };
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps."));
    document.head.appendChild(script);
  });

  return window.inmobiliariaGoogleMapsPromise;
}

function PropertyForm({
  form,
  isSaving,
  setForm,
  status,
  submitProperty,
  user,
}: {
  form: FormState;
  isSaving: boolean;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  status: string;
  submitProperty: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  user: AuthModel;
}) {
  return (
    <form className="grid gap-4" onSubmit={submitProperty}>
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
        Comentario
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
        Direccion o zona
        <input
          className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              locationLabel: event.target.value,
            }))
          }
          placeholder="Barrio, calle o zona"
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
          disabled={isSaving}
          multiple
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              photos: Array.from(event.target.files ?? []),
            }))
          }
          type="file"
        />
        <span className="text-xs font-normal leading-5 text-black/50">
          Acepta JPG/JPEG, PNG o WEBP. Las fotos se optimizan antes de publicar.
        </span>
      </label>
      {status ? (
        <p className="rounded-md border border-black/10 bg-[#f7f5f0] px-3 py-2 text-sm font-normal leading-6 text-black/70">
          {status}
        </p>
      ) : null}
      <button
        className="rounded-md bg-[#6e7d5b] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
        disabled={!user || isSaving}
        type="submit"
      >
        {isSaving ? "Publicando..." : form.id ? "Guardar cambios" : "Publicar"}
      </button>
    </form>
  );
}

export default function PropertyApp() {
  const pb = useMemo(() => getPocketBase(), []);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [selected, setSelected] = useState<PropertyListing | null>(null);
  const [user, setUser] = useState<AuthModel>(() => pb.authStore.model);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [search, setSearch] = useState("");
  const isSellerSession = Boolean(user);

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return properties;

    return properties.filter((property) =>
      [
        property.title,
        property.description,
        property.locationLabel,
        formatPrice(property),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [properties, search]);

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const filter = user?.id
        ? pb.filter("author = {:author}", { author: user.id })
        : 'status = "published" || status = "sold"';
      const records = await pb.collection("properties").getFullList({
        filter,
        sort: "-created",
      });
      const items = records.map(propertyFromRecord);
      setProperties(items.length || user ? items : demoProperties);
      setStatus("");
    } catch {
      setProperties(demoProperties);
      setStatus(
        "Mostrando propiedades de ejemplo. Conecta PocketBase para ver publicaciones reales.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [pb, user]);

  useEffect(() => {
    void Promise.resolve().then(loadProperties);

    return pb.authStore.onChange(() => {
      setUser(pb.authStore.model);
    });
  }, [loadProperties, pb]);

  useEffect(() => {
    let listener: { remove: () => void } | null = null;
    let cancelled = false;

    async function bootMap() {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        const google = await loadGoogleMaps();
        if (!google || cancelled || !mapContainerRef.current) return;

        const map = new google.maps.Map(mapContainerRef.current, {
          center: granCatamarcaCenter,
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: 12,
        });

        listener = map.addListener("click", (event) => {
          if (!event.latLng) return;

          if (!pb.authStore.model) {
            setStatus("Inicia sesion con Google para publicar en esa ubicacion.");
            return;
          }

          setForm((current) => ({
            ...current,
            latitude: event.latLng!.lat().toFixed(6),
            longitude: event.latLng!.lng().toFixed(6),
            locationLabel:
              current.locationLabel ||
              "Gran Catamarca, Catamarca",
          }));
          setIsEditorOpen(true);
          setStatus("Ubicacion exacta seleccionada. Completa los datos.");
        });

        mapRef.current = map;
        setIsMapReady(true);
      } catch {
        setStatus("No se pudo cargar Google Maps. Revisa NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.");
      }
    }

    void bootMap();

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [pb.authStore]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !window.google) return;

    const google = window.google;
    const overlays = filteredProperties.map((property) => {
      const overlay = new google.maps.OverlayView();
      let element: HTMLButtonElement | null = null;

      overlay.onAdd = () => {
        element = document.createElement("button");
        element.type = "button";
        element.className =
          "absolute z-10 w-[96px] overflow-hidden rounded-md border-2 border-white bg-white text-left shadow-lg transition hover:z-20 hover:scale-105 focus:z-20 focus:outline-none focus:ring-4 focus:ring-[#6e7d5b]/30";
        const photo = document.createElement("span");
        photo.className = "block h-[72px] bg-[#e8e2d8]";

        if (property.photos[0]) {
          const image = document.createElement("img");
          image.alt = property.title;
          image.className = "h-full w-full object-cover";
          image.src = property.photos[0];
          photo.appendChild(image);
        }

        const price = document.createElement("span");
        price.className = "block truncate px-2 py-1 text-xs font-semibold";
        price.textContent = formatPrice(property);

        element.append(photo, price);
        if (property.status === "sold") {
          const ribbon = document.createElement("span");
          ribbon.className =
            "absolute right-[-32px] top-3 rotate-45 bg-red-700 px-8 py-0.5 text-[10px] font-bold tracking-widest text-white";
          ribbon.textContent = "VENDIDO";
          element.appendChild(ribbon);
        }
        element.addEventListener("click", () => setSelected(property));
        overlay.getPanes()?.overlayMouseTarget?.appendChild(element);
      };

      overlay.draw = () => {
        if (!element) return;
        const projection = overlay.getProjection();
        const point = projection?.fromLatLngToDivPixel(
          new google.maps.LatLng(property.latitude, property.longitude),
        );
        if (!point) return;

        element.style.left = `${point.x - 48}px`;
        element.style.top = `${point.y - 52}px`;
      };

      overlay.onRemove = () => {
        element?.remove();
        element = null;
      };

      overlay.setMap(mapRef.current);
      return overlay;
    });

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null));
    };
  }, [filteredProperties, isMapReady]);

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
      photos: [],
      status: property.status,
    });
    setIsEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) return;

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

    try {
      setIsSaving(true);
      setStatus("Optimizando fotos...");
      const optimizedPhotos = await Promise.all(form.photos.map(compressPhoto));
      const payload = new FormData();
      payload.set("title", form.title.trim());
      payload.set("description", form.description.trim());
      payload.set("price", form.price);
      payload.set("currency", form.currency || defaultCurrency);
      payload.set("locationLabel", form.locationLabel.trim());
      payload.set("latitude", form.latitude);
      payload.set("longitude", form.longitude);
      payload.set("status", form.status ?? "published");
      payload.set("author", user.id);

      optimizedPhotos.forEach((file) => {
        payload.append("photos", file);
      });

      if (form.id) {
        await pb.collection("properties").update(form.id, payload);
        setStatus("Cambios guardados.");
      } else {
        await pb.collection("properties").create(payload);
        setStatus("Propiedad publicada.");
      }
      setForm(emptyForm);
      setIsEditorOpen(false);
      await loadProperties();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "No se pudo guardar. Revisa PocketBase, las reglas de acceso y los campos requeridos.",
      );
    } finally {
      setIsSaving(false);
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

  async function markPropertySold(property: PropertyListing) {
    if (!user) {
      setStatus("Inicia sesion con Google para marcar como vendido.");
      return;
    }

    if (property.author && property.author !== user.id) {
      setStatus("Solo el autor puede marcar esta propiedad como vendida.");
      return;
    }

    try {
      await pb.collection("properties").update(property.id, {
        status: "sold",
      });
      setSelected((current) =>
        current?.id === property.id ? { ...current, status: "sold" } : current,
      );
      setStatus("Propiedad marcada como vendida.");
      await loadProperties();
    } catch {
      setStatus("No se pudo marcar como vendida.");
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
              Propiedades en Venta Catamarca.
            </h1>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.16em] text-[#6e7d5b]">
              Publica la tuya
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/60">
              Explora la provincia desde el mapa, compara fotos y abre cada
              propiedad para ver precio, ubicacion y detalle.
            </p>
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

        <section className="grid gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                Mapa de propiedades en Gran Catamarca
              </h2>
              <p className="text-sm text-black/60">
                Move el mapa con el dedo o mouse, hace zoom hasta Valle Viejo,
                La Carrera o la zona exacta, y toca una foto para abrir la ficha.
              </p>
            </div>
            <label className="w-full max-w-sm text-sm font-medium md:text-right">
              Buscar zona
              <input
                className="mt-2 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-left font-normal outline-none focus:border-black"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ej: centro, norte, Valle Viejo"
                value={search}
              />
            </label>
          </div>

          <div className="relative min-h-[560px] overflow-hidden rounded-md border border-black/10 bg-[#d9ded0] shadow-sm">
            {googleMapsApiKey ? (
              <div ref={mapContainerRef} className="absolute inset-0" />
            ) : (
              <iframe
                className="absolute inset-0 h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={granCatamarcaMapUrl}
                title="Mapa de Gran Catamarca"
              />
            )}
            {!googleMapsApiKey
              ? filteredProperties.map((property) => {
                  const position = mapPosition(property);

                  return (
                    <button
                      className="absolute z-10 w-[92px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border-2 border-white bg-white text-left shadow-lg transition hover:z-20 hover:scale-105 focus:z-20 focus:outline-none focus:ring-4 focus:ring-[#6e7d5b]/30"
                      key={`map-${property.id}`}
                      onClick={() => setSelected(property)}
                      style={position}
                      type="button"
                    >
                      <span className="relative block aspect-[4/3] bg-[#e8e2d8]">
                        {property.status === "sold" ? <SoldRibbon /> : null}
                        {property.photos[0] ? (
                          <Image
                            alt={property.title}
                            className="object-cover"
                            fill
                            sizes="92px"
                            src={property.photos[0]}
                            unoptimized={property.photos[0].startsWith("http")}
                          />
                        ) : null}
                      </span>
                      <span className="block truncate px-2 py-1 text-xs font-semibold">
                        {formatPrice(property)}
                      </span>
                    </button>
                  );
                })
              : null}

            {!isLoading && filteredProperties.length === 0 ? (
              <div className="absolute bottom-4 left-4 right-4 rounded-md bg-white/95 p-4 text-sm text-black/60 shadow-sm md:left-auto md:w-[320px]">
                No hay propiedades para esa busqueda. Proba con otra zona.
              </div>
            ) : null}
          </div>
        </section>

        {isEditorOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6">
            <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-md bg-white p-5 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.14em] text-[#6e7d5b]">
                    Vendedor
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {form.id ? "Editar propiedad" : "Publicar en esta ubicacion"}
                  </h2>
                </div>
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm"
                  onClick={() => setIsEditorOpen(false)}
                  type="button"
                >
                  Cerrar
                </button>
              </div>
              <PropertyForm
                form={form}
                isSaving={isSaving}
                setForm={setForm}
                status={status}
                submitProperty={submitProperty}
                user={user}
              />
            </div>
          </div>
        ) : null}

        <section className="grid gap-5">
            <div className="flex items-end justify-between gap-4">
              <div>
              <h2 className="text-2xl font-semibold">
                {isSellerSession ? "Mis publicaciones" : "Propiedades destacadas"}
              </h2>
                <p className="text-sm text-black/60">
                  {isSellerSession
                    ? "En sesion vendedor solo aparecen tus propiedades."
                    : "Una vista rapida para comparar despues de explorar el mapa."}
                </p>
              </div>
              <span className="text-sm text-black/50">
                {isLoading
                  ? "Cargando..."
                  : isSellerSession
                    ? `${filteredProperties.length} propias`
                    : `${filteredProperties.length} publicadas`}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProperties.map((property) => (
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
                      {property.status === "sold" ? <SoldRibbon /> : null}
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
                </article>
              ))}
            </div>
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
              <div className="flex flex-wrap justify-end gap-2">
                {user && selected.author === user.id ? (
                  <>
                    <button
                      className="rounded-full border border-black/10 px-4 py-2 text-sm"
                      onClick={() => editProperty(selected)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-full border border-red-700/20 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
                      disabled={selected.status === "sold"}
                      onClick={() => markPropertySold(selected)}
                      type="button"
                    >
                      Vendido
                    </button>
                    <button
                      className="rounded-full border border-red-700/20 px-4 py-2 text-sm text-red-700"
                      onClick={() => deleteProperty(selected)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  </>
                ) : null}
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm"
                  onClick={() => setSelected(null)}
                  type="button"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
              <div className="grid gap-4">
                <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-[#e8e2d8]">
                  {selected.status === "sold" ? <SoldRibbon /> : null}
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
