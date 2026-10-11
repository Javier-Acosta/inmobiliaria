"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthModel } from "pocketbase";

import {
  adminEmails,
  defaultCurrency,
  googleMapsApiKey,
  mercadoPagoDonationUrl,
} from "@/lib/config";
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
  propertyType: string;
  contactPhone: string;
  price: string;
  currency: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
  photos: File[];
};

type ListingView = "all" | "mine" | "demo";
type StatusFilter = "all" | PropertyListing["status"];
type CurrencyFilter = "all" | "ARS" | "USD";
type SortOption = "recent" | "price-asc" | "price-desc";

const emptyForm: FormState = {
  title: "",
  description: "",
  propertyType: "",
  contactPhone: "",
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
const propertyTypeOptions = [
  "Casa",
  "Departamento",
  "Terreno",
  "Local",
  "Quinta",
  "Duplex",
];

const defaultPropertyType = propertyTypeOptions[0];

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

function PropertyPhoto({
  className = "",
  property,
  sizes,
}: {
  className?: string;
  property: PropertyListing;
  sizes: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#e8e2d8] ${className}`}>
      {property.status === "sold" ? <SoldRibbon /> : null}
      {property.photos[0] ? (
        <Image
          alt={property.title}
          className="object-cover"
          fill
          sizes={sizes}
          src={property.photos[0]}
          unoptimized={property.photos[0].startsWith("http")}
        />
      ) : (
        <div className="grid h-full place-items-center px-4 text-center">
          <div>
            <p className="text-sm font-semibold text-black/55">
              {property.propertyType}
            </p>
            <p className="mt-1 text-xs text-black/45">Sin foto cargada</p>
          </div>
        </div>
      )}
    </div>
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

function modelEmail(model: AuthModel) {
  if (!model) return "";
  const data = model as { email?: string };
  return data.email?.toLowerCase() ?? "";
}

function statusLabel(status: PropertyListing["status"]) {
  if (status === "sold") return "Vendido";
  if (status === "draft") return "Oculto";
  return "Disponible";
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

function mergeWithDemoProperties(items: PropertyListing[]) {
  const itemIds = new Set(items.map((property) => property.id));
  const demos = demoProperties.filter((property) => !itemIds.has(property.id));

  return [...items, ...demos];
}

function isDemoProperty(property: PropertyListing) {
  return property.author === "demo";
}

function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

function localPhoneInput(phone: string) {
  const digits = phoneDigits(phone);

  if (digits.startsWith("54") && digits.length > 10) {
    return digits.slice(2);
  }

  return digits.slice(0, 10);
}

function normalizeContactPhone(phone: string) {
  const digits = phoneDigits(phone);

  if (digits.startsWith("54") && digits.length >= 12) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+54${digits}`;
  }

  return phone.trim();
}

function displayContactPhone(phone: string) {
  return localPhoneInput(phone) || phone;
}

function editablePropertyType(propertyType: string) {
  if (propertyTypeOptions.includes(propertyType)) {
    return propertyType;
  }

  return defaultPropertyType;
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

async function adminPropertyRequest(
  id: string,
  options: {
    body?: Record<string, boolean | string>;
    method: "DELETE" | "PATCH";
    token: string;
  },
) {
  const response = await fetch(`/api/admin/properties/${id}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      authorization: `Bearer ${options.token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    method: options.method,
  });

  if (!response.ok) {
    throw new Error("Admin request failed.");
  }
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
  onPickMap,
  setForm,
  status,
  submitProperty,
  user,
}: {
  form: FormState;
  isSaving: boolean;
  onPickMap: () => void;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  status: string;
  submitProperty: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  user: AuthModel;
}) {
  const photoPreviews = useMemo(
    () =>
      form.photos.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [form.photos],
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [photoPreviews]);

  function removePhoto(index: number) {
    setForm((current) => ({
      ...current,
      photos: current.photos.filter((_, photoIndex) => photoIndex !== index),
    }));
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setForm((current) => {
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= current.photos.length) {
        return current;
      }

      const photos = [...current.photos];
      const [photo] = photos.splice(index, 1);
      photos.splice(targetIndex, 0, photo);

      return {
        ...current,
        photos,
      };
    });
  }

  return (
    <form className="grid gap-4" onSubmit={submitProperty}>
      {status ? (
        <p className="rounded-md border border-black/10 bg-[#f7f5f0] px-3 py-2 text-sm font-normal leading-6 text-black/70">
          {status}
        </p>
      ) : null}
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
      <label className="grid gap-1 text-sm font-medium">
        Tipo de propiedad
        <select
          className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              propertyType: event.target.value,
            }))
          }
          value={form.propertyType}
        >
          <option value="">Seleccionar tipo</option>
          {propertyTypeOptions.map((propertyType) => (
            <option key={propertyType} value={propertyType}>
              {propertyType}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Telefono o WhatsApp
        <input
          className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
          inputMode="tel"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              contactPhone: localPhoneInput(event.target.value),
            }))
          }
          maxLength={10}
          pattern="[0-9]*"
          placeholder="3834523879"
          value={form.contactPhone}
        />
        <span className="text-xs font-normal leading-5 text-black/50">
          Escribilo sin +54, solo los 10 numeros.
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="grid gap-1 text-sm font-medium">
          Precio
          <input
            className="rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-black"
            inputMode="decimal"
            min="0"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                price: event.target.value,
              }))
            }
            step="1"
            type="number"
            value={form.price}
          />
        </label>
        <div className="grid gap-1 text-sm font-medium">
          Moneda
          <div className="grid grid-cols-2 rounded-md border border-black/15 bg-white p-1 font-normal">
            {[
              { label: "USD", value: "USD" },
              { label: "ARS", value: "ARS" },
            ].map((option) => (
              <button
                className={`rounded px-3 py-2 text-sm font-semibold transition ${
                  form.currency === option.value
                    ? "bg-black text-white"
                    : "text-black/60 hover:bg-black/5 hover:text-black"
                }`}
                key={option.value}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    currency: option.value,
                  }))
                }
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
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
          value={form.locationLabel}
        />
      </label>
      <div className="grid gap-3 rounded-md border border-black/10 bg-[#f7f5f0] p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Ubicacion en el mapa</p>
            <p className="text-xs leading-5 text-black/50">
              No hace falta escribir coordenadas. Toca el mapa y la app las
              completa sola.
            </p>
          </div>
          <button
            className="rounded-md bg-[#6e7d5b] px-4 py-2 text-sm font-semibold text-white"
            onClick={onPickMap}
            type="button"
          >
            Elegir en mapa
          </button>
        </div>
        {form.latitude && form.longitude ? (
          <p className="rounded-md bg-white px-3 py-2 text-xs text-black/55">
            Ubicacion seleccionada: {form.latitude}, {form.longitude}
          </p>
        ) : (
          <p className="rounded-md bg-white px-3 py-2 text-xs text-black/45">
            Todavia no seleccionaste una ubicacion.
          </p>
        )}
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

      {photoPreviews.length > 0 ? (
        <div className="grid gap-3 rounded-md border border-black/10 bg-[#f7f5f0] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {photoPreviews.length} foto
              {photoPreviews.length === 1 ? "" : "s"} seleccionada
              {photoPreviews.length === 1 ? "" : "s"}
            </p>
            <button
              className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold"
              disabled={isSaving}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  photos: [],
                }))
              }
              type="button"
            >
              Quitar todas
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photoPreviews.map((preview, index) => (
              <div
                className="overflow-hidden rounded-md border border-black/10 bg-white"
                key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
              >
                <div className="relative aspect-[4/3] bg-[#e8e2d8]">
                  <Image
                    alt={`Vista previa ${index + 1}`}
                    className="object-cover"
                    fill
                    sizes="180px"
                    src={preview.url}
                    unoptimized
                  />
                  {index === 0 ? (
                    <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                      Portada
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-2 p-2">
                  <p className="truncate text-xs text-black/60">
                    {preview.file.name}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      className="rounded border border-black/10 px-2 py-1 text-xs disabled:opacity-40"
                      disabled={isSaving || index === 0}
                      onClick={() => movePhoto(index, -1)}
                      type="button"
                    >
                      Subir
                    </button>
                    <button
                      className="rounded border border-black/10 px-2 py-1 text-xs disabled:opacity-40"
                      disabled={isSaving || index === photoPreviews.length - 1}
                      onClick={() => movePhoto(index, 1)}
                      type="button"
                    >
                      Bajar
                    </button>
                    <button
                      className="rounded border border-red-700/20 px-2 py-1 text-xs text-red-700"
                      disabled={isSaving}
                      onClick={() => removePhoto(index)}
                      type="button"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const isPickingLocationRef = useRef(false);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [selected, setSelected] = useState<PropertyListing | null>(null);
  const [user, setUser] = useState<AuthModel>(() => pb.authStore.model);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [search, setSearch] = useState("");
  const [listingView, setListingView] = useState<ListingView>("all");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const isSellerSession = Boolean(user);
  const userId = user?.id;
  const isAdminSession = adminEmails.includes(modelEmail(user));

  useEffect(() => {
    isPickingLocationRef.current = isPickingLocation;
  }, [isPickingLocation]);

  const visibleProperties = useMemo(() => {
    const query = search.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;
    const viewItems = properties.filter((property) => {
      if (listingView === "demo") return isDemoProperty(property);
      if (listingView === "mine") {
        return Boolean(userId) && property.author === userId;
      }

      return true;
    });

    const filteredItems = viewItems.filter((property) => {
      if (
        propertyTypeFilter !== "all" &&
        property.propertyType !== propertyTypeFilter
      ) {
        return false;
      }

      if (statusFilter !== "all" && property.status !== statusFilter) {
        return false;
      }

      if (currencyFilter !== "all" && property.currency !== currencyFilter) {
        return false;
      }

      if (min !== null && Number.isFinite(min) && property.price < min) {
        return false;
      }

      if (max !== null && Number.isFinite(max) && property.price > max) {
        return false;
      }

      return true;
    });

    const searchedItems = query
      ? filteredItems.filter((property) =>
          [
            property.title,
            property.description,
            property.propertyType,
            property.contactPhone,
            property.locationLabel,
            formatPrice(property),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : filteredItems;

    return [...searchedItems].sort((first, second) => {
      if (first.featured !== second.featured) {
        return first.featured ? -1 : 1;
      }
      if (sortOption === "price-asc") return first.price - second.price;
      if (sortOption === "price-desc") return second.price - first.price;
      return 0;
    });
  }, [
    currencyFilter,
    listingView,
    maxPrice,
    minPrice,
    properties,
    propertyTypeFilter,
    search,
    sortOption,
    statusFilter,
    userId,
  ]);

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [];

    if (search.trim()) filters.push({ key: "search", label: search.trim() });
    if (propertyTypeFilter !== "all") {
      filters.push({ key: "type", label: propertyTypeFilter });
    }
    if (statusFilter !== "all") {
      filters.push({
        key: "status",
        label:
          statusFilter === "published"
            ? "Disponibles"
            : statusFilter === "sold"
              ? "Vendidas"
              : "Borradores",
      });
    }
    if (currencyFilter !== "all") {
      filters.push({ key: "currency", label: currencyFilter });
    }
    if (minPrice) filters.push({ key: "min", label: `Desde ${minPrice}` });
    if (maxPrice) filters.push({ key: "max", label: `Hasta ${maxPrice}` });
    if (sortOption === "price-asc") {
      filters.push({ key: "sort", label: "Menor precio" });
    }
    if (sortOption === "price-desc") {
      filters.push({ key: "sort", label: "Mayor precio" });
    }

    return filters;
  }, [
    currencyFilter,
    maxPrice,
    minPrice,
    propertyTypeFilter,
    search,
    sortOption,
    statusFilter,
  ]);

  const ownPropertiesCount = useMemo(
    () =>
      userId
        ? properties.filter((property) => property.author === userId).length
        : 0,
    [properties, userId],
  );

  const ownProperties = useMemo(
    () =>
      userId
        ? properties.filter((property) => property.author === userId)
        : [],
    [properties, userId],
  );

  const ownPublishedCount = useMemo(
    () =>
      ownProperties.filter((property) => property.status === "published")
        .length,
    [ownProperties],
  );

  const ownSoldCount = useMemo(
    () => ownProperties.filter((property) => property.status === "sold").length,
    [ownProperties],
  );

  const demoPropertiesCount = useMemo(
    () => properties.filter(isDemoProperty).length,
    [properties],
  );

  const adminProperties = useMemo(
    () => properties.filter((property) => !isDemoProperty(property)),
    [properties],
  );

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const filter = isAdminSession
        ? ""
        : userId
        ? pb.filter("author = {:author}", { author: userId })
        : 'status = "published" || status = "sold"';
      const records = await pb.collection("properties").getFullList({
        ...(filter ? { filter } : {}),
        sort: "-created",
      });
      const items = records.map(propertyFromRecord);
      setProperties(mergeWithDemoProperties(items));
      setStatus("");
    } catch {
      setProperties(demoProperties);
      setStatus(
        "Mostrando propiedades de ejemplo. Conecta PocketBase para ver publicaciones reales.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAdminSession, pb, userId]);

  useEffect(() => {
    void Promise.resolve().then(loadProperties);

    return pb.authStore.onChange(() => {
      const nextUser = pb.authStore.model;
      setUser(nextUser);
      if (!nextUser) {
        setListingView("all");
      }
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
          }));
          setIsPickingLocation(false);
          setIsEditorOpen(true);
          setStatus(
            isPickingLocationRef.current
              ? "Ubicacion seleccionada en el mapa."
              : "Ubicacion exacta seleccionada. Completa los datos.",
          );
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
    const overlays = visibleProperties.map((property) => {
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
        } else {
          photo.className =
            "grid h-[72px] place-items-center bg-[#e8e2d8] px-2 text-center text-[10px] font-semibold text-black/45";
          photo.textContent = property.propertyType;
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
        element.addEventListener("click", () => {
          router.push(`/propiedades/${property.id}`);
        });
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
  }, [visibleProperties, isMapReady, router]);

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
    setListingView("all");
    setStatus("Sesion cerrada.");
  }

  function startNewProperty() {
    if (!user) {
      setStatus("Inicia sesion con Google para publicar.");
      return;
    }

    setSelected(null);
    setForm(emptyForm);
    setIsEditorOpen(true);
    setStatus("Completa los datos de la nueva propiedad.");
  }

  function clearFilters() {
    setSearch("");
    setPropertyTypeFilter("all");
    setStatusFilter("all");
    setCurrencyFilter("all");
    setSortOption("recent");
    setMinPrice("");
    setMaxPrice("");
  }

  function startMapLocationPick() {
    setIsPickingLocation(true);
    setIsEditorOpen(false);
    setStatus("Toca el mapa donde esta la propiedad.");
    window.setTimeout(() => {
      mapContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  function selectFallbackMapLocation(event: React.MouseEvent<HTMLDivElement>) {
    if (!isPickingLocation) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const latitude =
      fallbackBounds.north - yRatio * (fallbackBounds.north - fallbackBounds.south);
    const longitude =
      fallbackBounds.west + xRatio * (fallbackBounds.east - fallbackBounds.west);

    setForm((current) => ({
      ...current,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    }));
    setIsPickingLocation(false);
    setIsEditorOpen(true);
    setStatus("Ubicacion seleccionada en el mapa.");
  }

  function editProperty(property: PropertyListing) {
    if (!user) {
      setStatus("Inicia sesion con Google para editar publicaciones.");
      return;
    }

    if (!isAdminSession && property.author && property.author !== user.id) {
      setStatus("Solo el autor puede editar esta propiedad.");
      return;
    }

    setForm({
      id: property.id,
      title: property.title,
      description: property.description,
      propertyType: editablePropertyType(property.propertyType),
      contactPhone: localPhoneInput(property.contactPhone),
      price: String(property.price),
      currency: property.currency,
      locationLabel: property.locationLabel,
      latitude: String(property.latitude),
      longitude: String(property.longitude),
      photos: [],
      status: property.status,
    });
    setIsEditorOpen(true);
    setStatus("Revisa los datos y guarda los cambios.");
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
      !form.propertyType ||
      !form.contactPhone.trim() ||
      !form.locationLabel.trim() ||
      !form.latitude ||
      !form.longitude
    ) {
      setStatus(
        "Completa titulo, descripcion, tipo, telefono, precio y ubicacion.",
      );
      return;
    }

    const price = Number(form.price);
    const contactPhone = normalizeContactPhone(form.contactPhone);

    if (!Number.isFinite(price) || price <= 0) {
      setStatus("Ingresa un precio mayor a cero.");
      return;
    }

    if (phoneDigits(contactPhone).length < 12) {
      setStatus("Ingresa un telefono local de 10 numeros, por ejemplo 3834523879.");
      return;
    }

    try {
      setIsSaving(true);
      const optimizedPhotos: File[] = [];

      for (const [index, photo] of form.photos.entries()) {
        setStatus(
          `Optimizando foto ${index + 1} de ${form.photos.length}...`,
        );
        optimizedPhotos.push(await compressPhoto(photo));
      }

      setStatus(
        optimizedPhotos.length > 0
          ? "Subiendo publicacion y fotos..."
          : "Guardando publicacion...",
      );
      const payload = new FormData();
      payload.set("title", form.title.trim());
      payload.set("description", form.description.trim());
      payload.set("propertyType", form.propertyType);
      payload.set("contactPhone", contactPhone);
      payload.set("price", String(price));
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

    if (!isAdminSession && property.author && property.author !== user.id) {
      setStatus("Solo el autor puede eliminar esta propiedad.");
      return;
    }

    if (!window.confirm(`Eliminar "${property.title}"?`)) return;

    try {
      if (isAdminSession) {
        await adminPropertyRequest(property.id, {
          method: "DELETE",
          token: pb.authStore.token,
        });
      } else {
        await pb.collection("properties").delete(property.id);
      }
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

    if (!isAdminSession && property.author && property.author !== user.id) {
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

  async function updatePropertyStatus(
    property: PropertyListing,
    nextStatus: PropertyListing["status"],
  ) {
    if (!user) {
      setStatus("Inicia sesion con Google para administrar.");
      return;
    }

    if (!isAdminSession && property.author && property.author !== user.id) {
      setStatus("Solo el autor puede cambiar esta propiedad.");
      return;
    }

    try {
      if (isAdminSession) {
        await adminPropertyRequest(property.id, {
          body: { status: nextStatus },
          method: "PATCH",
          token: pb.authStore.token,
        });
      } else {
        await pb.collection("properties").update(property.id, {
          status: nextStatus,
        });
      }
      setSelected((current) =>
        current?.id === property.id ? { ...current, status: nextStatus } : current,
      );
      setStatus(
        nextStatus === "draft"
          ? "Publicacion oculta."
          : nextStatus === "sold"
            ? "Propiedad marcada como vendida."
            : "Publicacion visible.",
      );
      await loadProperties();
    } catch {
      setStatus("No se pudo actualizar el estado.");
    }
  }

  async function toggleFeaturedProperty(property: PropertyListing) {
    if (!isAdminSession) {
      setStatus("Solo un administrador puede destacar publicaciones.");
      return;
    }

    try {
      const featured = !property.featured;
      await adminPropertyRequest(property.id, {
        body: { featured },
        method: "PATCH",
        token: pb.authStore.token,
      });
      setSelected((current) =>
        current?.id === property.id ? { ...current, featured } : current,
      );
      setStatus(featured ? "Publicacion destacada." : "Destaque quitado.");
      await loadProperties();
    } catch {
      setStatus(
        "No se pudo cambiar el destaque. Revisa que exista el campo featured en PocketBase.",
      );
    }
  }

  async function shareProperty(property: PropertyListing) {
    if (typeof window === "undefined") return;

    const url = `${window.location.origin}/propiedades/${property.id}`;
    const text = `${property.title} - ${formatPrice(property)}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: property.title,
          text,
          url,
        });
        setStatus("Link compartido.");
        return;
      }

      await copyTextToClipboard(url);
      setStatus("Link copiado para compartir.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setStatus("No se pudo compartir el link.");
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
            <div className="mt-4 flex max-w-2xl flex-col gap-3 text-base leading-7 text-black/60 sm:flex-row sm:items-center">
              <p>
                No cobramos porcentaje de venta. Si este sitio te ayuda a
                publicar o encontrar propiedades, podes hacer una pequena
                donacion para mantenerlo activo y seguir mejorandolo.
              </p>
              {mercadoPagoDonationUrl ? (
                <a
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#009ee3] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0088c7]"
                  href={mercadoPagoDonationUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Donar por Mercado Pago
                </a>
              ) : (
                <span className="inline-flex shrink-0 items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2 text-sm font-semibold text-black/45">
                  Mercado Pago pendiente
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <span className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm">
                  {modelName(user)}
                </span>
                <button
                  className="rounded-full bg-[#6e7d5b] px-5 py-2 text-sm font-medium text-white"
                  onClick={startNewProperty}
                  type="button"
                >
                  Nueva publicacion
                </button>
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
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-2xl font-semibold">
                Mapa de propiedades en Gran Catamarca
              </h2>
              <p className="text-sm text-black/60">
                Move el mapa con el dedo o mouse, hace zoom hasta Valle Viejo,
                La Carrera o la zona exacta, y toca una foto para abrir la ficha.
              </p>
            </div>
            <div className="grid gap-4 rounded-md border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {isLoading
                      ? "Buscando propiedades..."
                      : `${visibleProperties.length} resultado${
                          visibleProperties.length === 1 ? "" : "s"
                        }`}
                  </p>
                  <p className="text-sm text-black/50">
                    Combina zona, tipo, precio y moneda para encontrar mas rapido.
                  </p>
                </div>
                <button
                  className="w-full rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-black/70 transition hover:bg-black/5 sm:w-auto"
                  onClick={clearFilters}
                  type="button"
                >
                  Limpiar filtros
                </button>
              </div>

              {activeFilters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <span
                      className="rounded-full bg-[#edf2e7] px-3 py-1 text-xs font-semibold text-[#4d5e39]"
                      key={filter.key}
                    >
                      {filter.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr]">
              <label className="grid gap-1 text-sm font-medium">
                Buscar
                <input
                  className="rounded-md border border-black/15 bg-white px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Zona, titulo, tipo o telefono"
                  value={search}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Tipo
                <select
                  className="rounded-md border border-black/15 bg-white px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) => setPropertyTypeFilter(event.target.value)}
                  value={propertyTypeFilter}
                >
                  <option value="all">Todos</option>
                  {propertyTypeOptions.map((propertyType) => (
                    <option key={propertyType} value={propertyType}>
                      {propertyType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Estado
                <select
                  className="rounded-md border border-black/15 bg-white px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  value={statusFilter}
                >
                  <option value="all">Todos</option>
                  <option value="published">Disponibles</option>
                  <option value="sold">Vendidas</option>
                  {isSellerSession ? <option value="draft">Borradores</option> : null}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Moneda
                <select
                  className="rounded-md border border-black/15 bg-white px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) =>
                    setCurrencyFilter(event.target.value as CurrencyFilter)
                  }
                  value={currencyFilter}
                >
                  <option value="all">Todas</option>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Orden
                <select
                  className="rounded-md border border-black/15 bg-white px-3 py-2 font-normal outline-none focus:border-black"
                  onChange={(event) =>
                    setSortOption(event.target.value as SortOption)
                  }
                  value={sortOption}
                >
                  <option value="recent">Mas recientes</option>
                  <option value="price-asc">Menor precio</option>
                  <option value="price-desc">Mayor precio</option>
                </select>
              </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
              <label className="grid gap-1 text-sm font-medium">
                Precio minimo
                <input
                  className="rounded-md border border-black/15 bg-white px-3 py-2 font-normal outline-none focus:border-black"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder="Ej: 50000"
                  type="number"
                  value={minPrice}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Precio maximo
                <input
                  className="rounded-md border border-black/15 bg-white px-3 py-2 font-normal outline-none focus:border-black"
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="Ej: 150000"
                  type="number"
                  value={maxPrice}
                />
              </label>
              </div>
            </div>
          </div>

          <div
            className={`relative min-h-[560px] overflow-hidden rounded-md border bg-[#d9ded0] shadow-sm ${
              isPickingLocation
                ? "cursor-crosshair border-[#6e7d5b] ring-4 ring-[#6e7d5b]/25"
                : "border-black/10"
            }`}
            onClick={selectFallbackMapLocation}
            ref={!googleMapsApiKey ? mapContainerRef : undefined}
          >
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
            {isPickingLocation ? (
              <div className="pointer-events-none absolute left-4 right-4 top-4 z-30 rounded-md bg-white/95 px-4 py-3 text-sm font-semibold text-[#4d5e39] shadow-sm md:left-auto md:w-[340px]">
                Toca el punto exacto donde esta la propiedad.
              </div>
            ) : null}
            {isPickingLocation && !googleMapsApiKey ? (
              <button
                aria-label="Seleccionar ubicacion en el mapa"
                className="absolute inset-0 z-20 cursor-crosshair bg-transparent"
                type="button"
              />
            ) : null}
            {!googleMapsApiKey
              ? visibleProperties.map((property) => {
                  const position = mapPosition(property);

                  return (
                    <Link
                      className="absolute z-10 w-[92px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border-2 border-white bg-white text-left shadow-lg transition hover:z-20 hover:scale-105 focus:z-20 focus:outline-none focus:ring-4 focus:ring-[#6e7d5b]/30"
                      href={`/propiedades/${property.id}`}
                      key={`map-${property.id}`}
                      style={position}
                    >
                      <PropertyPhoto
                        className="block aspect-[4/3]"
                        property={property}
                        sizes="92px"
                      />
                      <span className="block truncate px-2 py-1 text-xs font-semibold">
                        {formatPrice(property)}
                      </span>
                    </Link>
                  );
                })
              : null}

            {!isLoading && visibleProperties.length === 0 ? (
              <div className="absolute bottom-4 left-4 right-4 rounded-md bg-white/95 p-4 text-sm text-black/60 shadow-sm md:left-auto md:w-[320px]">
                No hay propiedades para esta vista. Proba con otro filtro o busqueda.
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
                onPickMap={startMapLocationPick}
                setForm={setForm}
                status={status}
                submitProperty={submitProperty}
                user={user}
              />
            </div>
          </div>
        ) : null}

        {isAdminSession ? (
          <section className="grid gap-5 rounded-md border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.14em] text-[#6e7d5b]">
                  Administracion
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  Revisar publicaciones
                </h2>
                <p className="mt-1 text-sm text-black/60">
                  Oculta, publica o destaca propiedades desde un solo lugar.
                </p>
              </div>
              <span className="w-fit rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                {adminProperties.length} reales
              </span>
            </div>

            {adminProperties.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-black/10">
                <div className="hidden grid-cols-[1fr_120px_260px] gap-4 border-b border-black/10 bg-[#f7f5f0] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-black/50 lg:grid">
                  <span>Publicacion</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>
                <div className="divide-y divide-black/10">
                  {adminProperties.map((property) => (
                    <article
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_120px_260px] lg:items-center"
                      key={`admin-${property.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="font-semibold transition hover:text-[#6e7d5b]"
                            href={`/propiedades/${property.id}`}
                          >
                            {property.title}
                          </Link>
                          {property.featured ? (
                            <span className="rounded-full bg-[#edf2e7] px-2 py-1 text-xs font-semibold text-[#4d5e39]">
                              Destacada
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-black/60">
                          {formatPrice(property)} · {property.locationLabel}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          property.status === "sold"
                            ? "bg-red-50 text-red-700"
                            : property.status === "draft"
                              ? "bg-black/5 text-black/55"
                              : "bg-[#edf2e7] text-[#4d5e39]"
                        }`}
                      >
                        {statusLabel(property.status)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-black/10 px-3 py-2 text-sm"
                          onClick={() => toggleFeaturedProperty(property)}
                          type="button"
                        >
                          {property.featured ? "Quitar destaque" : "Destacar"}
                        </button>
                        <button
                          className="rounded-md border border-black/10 px-3 py-2 text-sm"
                          onClick={() =>
                            updatePropertyStatus(
                              property,
                              property.status === "draft" ? "published" : "draft",
                            )
                          }
                          type="button"
                        >
                          {property.status === "draft" ? "Publicar" : "Ocultar"}
                        </button>
                        <button
                          className="rounded-md border border-red-700/20 px-3 py-2 text-sm text-red-700"
                          onClick={() => deleteProperty(property)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-black/15 bg-[#f7f5f0] p-5 text-sm text-black/60">
                Todavia no hay publicaciones reales para administrar.
              </div>
            )}
          </section>
        ) : null}

        {isSellerSession ? (
          <section className="grid gap-5 rounded-md border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.14em] text-[#6e7d5b]">
                  Vendedor
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  Mis publicaciones
                </h2>
                <p className="mt-1 text-sm text-black/60">
                  Administra tus propiedades sin mezclarlas con ejemplos ni
                  publicaciones de otros vendedores.
                </p>
              </div>
              <button
                className="w-full rounded-md bg-[#6e7d5b] px-4 py-3 text-sm font-semibold text-white sm:w-auto"
                onClick={startNewProperty}
                type="button"
              >
                Nueva publicacion
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-[#f7f5f0] p-4">
                <p className="text-sm text-black/50">Total</p>
                <p className="mt-1 text-2xl font-semibold">
                  {ownProperties.length}
                </p>
              </div>
              <div className="rounded-md bg-[#f7f5f0] p-4">
                <p className="text-sm text-black/50">Disponibles</p>
                <p className="mt-1 text-2xl font-semibold">
                  {ownPublishedCount}
                </p>
              </div>
              <div className="rounded-md bg-[#f7f5f0] p-4">
                <p className="text-sm text-black/50">Vendidas</p>
                <p className="mt-1 text-2xl font-semibold">{ownSoldCount}</p>
              </div>
            </div>

            {ownProperties.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-black/10">
                <div className="hidden grid-cols-[96px_1fr_120px_220px] gap-4 border-b border-black/10 bg-[#f7f5f0] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-black/50 lg:grid">
                  <span>Foto</span>
                  <span>Publicacion</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>
                <div className="divide-y divide-black/10">
                  {ownProperties.map((property) => (
                    <article
                      className="grid gap-4 px-4 py-4 lg:grid-cols-[96px_1fr_120px_220px] lg:items-center"
                      key={`seller-${property.id}`}
                    >
                      <Link
                        className="block w-24 overflow-hidden rounded-md border border-black/10"
                        href={`/propiedades/${property.id}`}
                      >
                        <PropertyPhoto
                          className="aspect-[4/3]"
                          property={property}
                          sizes="96px"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          className="font-semibold transition hover:text-[#6e7d5b]"
                          href={`/propiedades/${property.id}`}
                        >
                          {property.title}
                        </Link>
                        <p className="mt-1 text-sm text-black/60">
                          {formatPrice(property)} · {property.propertyType}
                        </p>
                        <p className="mt-1 truncate text-sm text-[#6e7d5b]">
                          {property.locationLabel}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          property.status === "sold"
                            ? "bg-red-50 text-red-700"
                            : property.status === "draft"
                              ? "bg-black/5 text-black/55"
                              : "bg-[#edf2e7] text-[#4d5e39]"
                        }`}
                      >
                        {statusLabel(property.status)}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="rounded-md border border-black/10 px-3 py-2 text-sm"
                          href={`/propiedades/${property.id}`}
                        >
                          Ver
                        </Link>
                        <button
                          className="rounded-md border border-black/10 px-3 py-2 text-sm"
                          onClick={() => shareProperty(property)}
                          type="button"
                        >
                          Compartir
                        </button>
                        <button
                          className="rounded-md border border-black/10 px-3 py-2 text-sm"
                          onClick={() => editProperty(property)}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="rounded-md border border-red-700/20 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                          disabled={property.status === "sold"}
                          onClick={() => markPropertySold(property)}
                          type="button"
                        >
                          Vendido
                        </button>
                        <button
                          className="rounded-md border border-red-700/20 px-3 py-2 text-sm text-red-700"
                          onClick={() => deleteProperty(property)}
                          type="button"
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-black/15 bg-[#f7f5f0] p-5 text-sm text-black/60">
                Todavia no tenes publicaciones propias. Crea la primera desde
                el boton Nueva publicacion o tocando una ubicacion en el mapa.
              </div>
            )}
          </section>
        ) : null}

        <section className="grid gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
              <h2 className="text-2xl font-semibold">
                Publicaciones
              </h2>
                <p className="text-sm text-black/60">
                  {isSellerSession
                    ? "Separa tus propiedades reales de los ejemplos cuando quieras revisar tu trabajo."
                    : "Una vista rapida para comparar despues de explorar el mapa."}
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="inline-flex rounded-md border border-black/10 bg-white p-1 text-sm shadow-sm">
                  {[
                    {
                      label: `Todas (${properties.length})`,
                      value: "all" as const,
                    },
                    ...(isSellerSession
                      ? [
                          {
                            label: `Mis publicaciones (${ownPropertiesCount})`,
                            value: "mine" as const,
                          },
                        ]
                      : []),
                    {
                      label: `Ejemplos (${demoPropertiesCount})`,
                      value: "demo" as const,
                    },
                  ].map((option) => (
                    <button
                      className={`rounded px-3 py-2 font-medium transition ${
                        listingView === option.value
                          ? "bg-black text-white"
                          : "text-black/60 hover:bg-black/5 hover:text-black"
                      }`}
                      key={option.value}
                      onClick={() => setListingView(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-black/50">
                  {isLoading
                    ? "Cargando..."
                    : listingView === "mine"
                      ? `${visibleProperties.length} propias`
                      : listingView === "demo"
                        ? `${visibleProperties.length} ejemplos`
                        : `${visibleProperties.length} en vista`}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleProperties.map((property) => (
                <article
                  className="overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
                  key={property.id}
                >
                  <Link
                    className="block w-full text-left"
                    href={`/propiedades/${property.id}`}
                  >
                    <PropertyPhoto
                      className="aspect-[4/3]"
                      property={property}
                      sizes="(min-width: 1280px) 280px, (min-width: 768px) 50vw, 100vw"
                    />
                    <div className="grid gap-2 p-4">
                      <p className="text-lg font-semibold">
                        {formatPrice(property)}
                      </p>
                      <h3 className="font-medium">{property.title}</h3>
                      <p className="text-sm font-medium text-black/50">
                        {property.propertyType}
                      </p>
                      <p className="line-clamp-2 text-sm text-black/60">
                        {property.description}
                      </p>
                      <p className="text-sm text-[#6e7d5b]">
                        {property.locationLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {property.featured ? (
                          <span className="w-fit rounded-full bg-[#edf2e7] px-2 py-1 text-xs font-semibold text-[#4d5e39]">
                            Destacada
                          </span>
                        ) : null}
                        {property.status === "draft" ? (
                          <span className="w-fit rounded-full bg-black/5 px-2 py-1 text-xs font-medium text-black/50">
                            Oculta
                          </span>
                        ) : null}
                      </div>
                      {property.contactPhone ? (
                        <p className="text-sm text-black/50">
                          {displayContactPhone(property.contactPhone)}
                        </p>
                      ) : null}
                      {isDemoProperty(property) ? (
                        <span className="w-fit rounded-full bg-[#f7f5f0] px-2 py-1 text-xs font-medium text-black/50">
                          Ejemplo
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="border-t border-black/10 p-4 pt-3">
                    <button
                      className="w-full rounded-md border border-black/10 px-3 py-2 text-sm font-semibold transition hover:bg-black hover:text-white"
                      onClick={() => shareProperty(property)}
                      type="button"
                    >
                      Compartir
                    </button>
                  </div>
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
                <p className="mt-1 text-sm font-medium text-black/50">
                  {selected.propertyType}
                </p>
                <h2 className="mt-1 text-3xl font-semibold">
                  {selected.title}
                </h2>
                <p className="mt-2 text-xl font-semibold">
                  {formatPrice(selected)}
                </p>
                {selected.contactPhone ? (
                  <p className="mt-2 text-sm text-black/60">
                    Contacto: {displayContactPhone(selected.contactPhone)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {selected.contactPhone ? (
                  <>
                    <a
                      className="rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white"
                      href={whatsappUrl(selected)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      WhatsApp
                    </a>
                    <a
                      className="rounded-full border border-black/10 px-4 py-2 text-sm"
                      href={`tel:${phoneHref(selected.contactPhone)}`}
                    >
                      Llamar
                    </a>
                  </>
                ) : null}
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm"
                  onClick={() => shareProperty(selected)}
                  type="button"
                >
                  Compartir
                </button>
                {user && (isAdminSession || selected.author === user.id) ? (
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
                      onClick={() =>
                        isAdminSession
                          ? updatePropertyStatus(selected, "sold")
                          : markPropertySold(selected)
                      }
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
                <PropertyPhoto
                  className="aspect-[16/9] rounded-md"
                  property={selected}
                  sizes="(min-width: 1024px) 60vw, 100vw"
                />
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
