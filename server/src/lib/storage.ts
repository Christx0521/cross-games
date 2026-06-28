import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Interfaz de almacenamiento de archivos. Hoy: disco local.
// Mañana: S3/R2 implementando esta misma interfaz, sin tocar el resto.
export interface Storage {
  save(data: Buffer, ext: string): Promise<string>; // devuelve la URL pública (path)
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function extForMime(mime: string): string | null {
  return EXT_BY_MIME[mime] ?? null;
}

export function createDiskStorage(opts: { dir: string; publicPath: string }): Storage {
  return {
    async save(data: Buffer, ext: string): Promise<string> {
      await mkdir(opts.dir, { recursive: true });
      const name = `${randomUUID()}.${ext}`;
      await writeFile(join(opts.dir, name), data);
      return `${opts.publicPath}/${name}`;
    },
  };
}
