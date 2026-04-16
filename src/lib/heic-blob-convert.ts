import path from "node:path";

function replaceBlobPathExtension(pathname: string, newExtWithDot: string): string {
  const base = path.posix.basename(pathname);
  const dir = pathname.slice(0, Math.max(0, pathname.length - base.length));
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${dir}${stem}${newExtWithDot}`;
}

/** True when pathname / declared type indicate HEIC/HEIF (full buffer not yet read). */
export function uploadLooksHeicFromMeta(pathname: string, contentType: string): boolean {
  const ct = (contentType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (
    ct === "image/heic" ||
    ct === "image/heif" ||
    ct === "image/heic-sequence" ||
    ct === "image/heif-sequence"
  ) {
    return true;
  }
  const pl = pathname.toLowerCase();
  return pl.endsWith(".heic") || pl.endsWith(".heif");
}

/**
 * Detect iOS / HEIF still images we should convert for web display.
 * Skips AVIF and unrelated ISO-BMFF types.
 */
export function isHeicLikeUpload(pathname: string, contentType: string, buf: Buffer): boolean {
  const ct = (contentType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (ct === "image/avif") return false;
  if (
    ct === "image/heic" ||
    ct === "image/heif" ||
    ct === "image/heic-sequence" ||
    ct === "image/heif-sequence"
  ) {
    return true;
  }

  const pl = pathname.toLowerCase();
  if (pl.endsWith(".heic") || pl.endsWith(".heif")) return true;

  if (buf.length < 12) return false;
  if (buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) return false;
  const brand = buf.toString("ascii", 8, 12);
  if (brand === "avif") return false;
  const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);
  return heicBrands.has(brand);
}

function heicEncodeToBuffer(jpeg: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(jpeg)) return jpeg;
  if (jpeg instanceof ArrayBuffer) return Buffer.from(jpeg);
  return Buffer.from(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
}

/**
 * If the upload is HEIC/HEIF, decodes and re-encodes as JPEG for browsers.
 * Otherwise returns the input unchanged.
 */
export async function maybeConvertHeicForBlobUpload(opts: {
  buffer: Buffer;
  pathname: string;
  contentType: string;
}): Promise<{
  buffer: Buffer;
  pathname: string;
  contentType: string;
  heicConverted: boolean;
}> {
  if (!isHeicLikeUpload(opts.pathname, opts.contentType, opts.buffer)) {
    return {
      buffer: opts.buffer,
      pathname: opts.pathname,
      contentType: opts.contentType,
      heicConverted: false,
    };
  }

  const { default: convert } = await import("heic-convert");
  const jpeg = await convert({
    buffer: opts.buffer,
    format: "JPEG",
    quality: 0.92,
  });
  return {
    buffer: heicEncodeToBuffer(jpeg),
    pathname: replaceBlobPathExtension(opts.pathname, ".jpg"),
    contentType: "image/jpeg",
    heicConverted: true,
  };
}
