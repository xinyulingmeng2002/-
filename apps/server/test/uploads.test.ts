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
      const body = response.json() as {
        attachment: {
          id: string;
          messageId: string;
          kind: string;
          url: string;
        };
        originalName: string;
      };
      expect(body).toMatchObject({
        attachment: {
          kind: "image",
          messageId: ""
        },
        originalName: "diagram.png"
      });
      expect(Object.keys(body.attachment).sort()).toEqual(["id", "kind", "messageId", "url"]);

      const attachmentUrl = new URL(body.attachment.url);
      expect(attachmentUrl.protocol).toBe("http:");
      expect(attachmentUrl.host).toBe("localhost");

      const relativePath = attachmentUrl.pathname.replace(/^\/uploads\//, "");
      const storedPath = join(tempDir, "data", "uploads", relativePath);
      expect(readFileSync(storedPath)).toEqual(pngBuffer);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });

  it("uses absolute configured uploads URL as-is", async () => {
    const tempDir = createTempDir();
    const app = buildServer({
      dataDir: tempDir,
      uploadsPublicBasePath: "https://cdn.example.com/uploads"
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/uploads",
        payload: makeMultipartFile("diagram.png", "image/png", pngBuffer),
        headers: multipartHeaders
      });

      expect(response.statusCode).toBe(201);

      const body = response.json() as {
        attachment: {
          url: string;
        };
      };
      expect(body.attachment.url.startsWith("https://cdn.example.com/uploads/")).toBe(true);
    } finally {
      await app.close();
      cleanupTempDir(tempDir);
    }
  });
});
