const configuredPocketbaseUrl =
  process.env.NEXT_PUBLIC_POCKETBASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8090";

export const pocketbaseUrl =
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  configuredPocketbaseUrl.startsWith("http://")
    ? configuredPocketbaseUrl.replace(/^http:/, "https:")
    : configuredPocketbaseUrl;

const configuredDefaultCurrency =
  process.env.NEXT_PUBLIC_DEFAULT_CURRENCY?.trim().toUpperCase();

export const defaultCurrency =
  configuredDefaultCurrency === "ARS" ? "ARS" : "USD";

export const googleMapsApiKey =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || "";
