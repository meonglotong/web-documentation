// src/lib/files/limits.ts
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const INLINE = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt", "md", "html", "csv"]);
export function extFromFilename(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
}
export function isInlineExt(ext: string): boolean {
  return INLINE.has(ext);
}
