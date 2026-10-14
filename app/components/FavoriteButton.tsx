"use client";

export default function FavoriteButton({
  isFavorite,
  onToggle,
  className = "",
}: {
  isFavorite: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = isFavorite ? "Quitar de favoritos" : "Guardar en favoritos";
  return (
    <button
      aria-label={label}
      aria-pressed={isFavorite}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border border-black/10 bg-white text-2xl shadow-sm transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${isFavorite ? "text-red-700" : "text-black/60"} ${className}`}
      onClick={onToggle}
      title={label}
      type="button"
    >
      <span aria-hidden="true">{isFavorite ? "\u2665" : "\u2661"}</span>
    </button>
  );
}
