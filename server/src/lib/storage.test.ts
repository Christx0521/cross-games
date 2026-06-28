import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDiskStorage, extForMime } from "./storage.ts";

test("extForMime mapea mimes soportados y rechaza otros", () => {
  assert.equal(extForMime("image/png"), "png");
  assert.equal(extForMime("image/jpeg"), "jpg");
  assert.equal(extForMime("image/webp"), "webp");
  assert.equal(extForMime("application/pdf"), null);
});

test("createDiskStorage.save escribe el archivo y devuelve una url pública", async () => {
  const dir = join(tmpdir(), `cg-storage-${Date.now()}`);
  const storage = createDiskStorage({ dir, publicPath: "/uploads" });
  const data = Buffer.from("fake-image-bytes");
  const url = await storage.save(data, "png");

  assert.match(url, /^\/uploads\/[0-9a-f-]+\.png$/);
  const filename = url.split("/").pop()!;
  const written = await readFile(join(dir, filename));
  assert.deepEqual(written, data);

  await rm(dir, { recursive: true, force: true });
});
