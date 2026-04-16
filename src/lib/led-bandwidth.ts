/**
 * Idealized uncompressed pixel-stream bandwidth (no framing, no LED mapping overhead).
 * Mbps = pixels × fps × bitsPerPixel / 1e6
 */
export function streamBandwidthMbps(pixels: number, fps: number, bitsPerPixel: number): number {
  if (pixels < 0 || fps < 0 || bitsPerPixel < 0) return 0;
  return (pixels * fps * bitsPerPixel) / 1e6;
}

/** Conservative max pixel count that fits in usable link capacity (floor). */
export function maxPixelsForLink(usableLinkMbps: number, fps: number, bitsPerPixel: number): number {
  if (usableLinkMbps <= 0 || fps <= 0 || bitsPerPixel <= 0) return 0;
  return Math.floor((usableLinkMbps * 1e6) / (fps * bitsPerPixel));
}

/** Typical payload-ish ceilings; tune in UI — Ethernet/IP overhead is real. */
export const DEFAULT_USABLE_MBPS_1G = 940;
/** ~94% of 5 Gbit/s line rate, same overhead assumption as 1G preset. */
export const DEFAULT_USABLE_MBPS_5G = 4700;

/** Full RGB triplets: total bits per pixel = bpc × 3 (e.g. 8→RGB888 / 24 bpp). */
export const RGB_BPC_PRESETS = [8, 10, 12] as const;
export type RgbBitsPerChannel = (typeof RGB_BPC_PRESETS)[number];

export function totalBppRgbPacked(bpc: number): number {
  return Math.max(0, bpc) * 3;
}

export const FPS_REFERENCE = [30, 60] as const;
