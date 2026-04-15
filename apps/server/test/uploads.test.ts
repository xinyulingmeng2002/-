import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { cleanupTempDir, createTempDir } from "./helpers";
import { makeMultipartFile, multipartHeaders } from "./multipart";

const pngBuffer = Buffer.from("89504E470D0A1A0A", "hex");

describe("uploads api", () => {
  it("stores attachment files and returns message-safe metadata", async () => {
    const tempDir = createTempDir();
    const app = buildServer({ dataDir: tempDir });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/uploads",
        payload: makeMultipartFile("diagram.png", "image/png", pngBuffer),
        headers: multipartHeaders
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        kind: "image",
        originalName: "diagram.png"
      });

      const body = response.json() as { url: string };
      const relativePath = body.url.replace("/uploads/", "");
      const storedPath = join(tempDir, "data", "uploads", relativePath);
      expect(readFileSync(storedPath)).toEqual(pngBuffer);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
