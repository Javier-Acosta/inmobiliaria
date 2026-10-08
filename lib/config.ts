export const pocketbaseUrl =
  process.env.NEXT_PUBLIC_POCKETBASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8090";

export const defaultCurrency =
  process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.trim() || "ARS";

export const googleMapsApiKey =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
