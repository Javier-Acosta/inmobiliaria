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

export const mercadoPagoDonationUrl =
  process.env.NEXT_PUBLIC_MERCADO_PAGO_DONATION_URL?.trim() || "";

export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  "https://inmobiliaria.catamarca.io";

export const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const serverAdminEmails = (
  process.env.ADMIN_EMAILS ??
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ??
  ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
