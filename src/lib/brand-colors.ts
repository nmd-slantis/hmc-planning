export const BRAND_COLORS = [
  "#FF7700", // orange — /slantis primary
  "#1d4ed8", // blue
  "#047857", // emerald
  "#7c3aed", // violet
  "#b45309", // amber
  "#be123c", // rose
  "#0e7490", // cyan
  "#4f46e5", // indigo
  "#15803d", // green
  "#9333ea", // purple
];

export function randomBrandColor(): string {
  return BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)];
}

export function pickBrandColor(index: number): string {
  return BRAND_COLORS[index % BRAND_COLORS.length];
}
