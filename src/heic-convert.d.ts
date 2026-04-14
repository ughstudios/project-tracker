declare module "heic-convert" {
  export interface HeicConvertOptions {
    buffer: Buffer;
    format: "JPEG" | "PNG";
    quality?: number;
  }

  function convert(options: HeicConvertOptions): Promise<Buffer>;
  export default convert;
}
