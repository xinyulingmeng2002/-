import { randomUUID } from "node:crypto";
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";

type UploadsRoutesOptions = {
  uploadsDir: string;
  uploadsPublicBasePath: string;
};

function sanitizeFilename(filename: string): string {
  const withoutPathSeparators = filename.replace(/[\\/]+/g, "-");
  const normalized = withoutPathSeparators.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const collapsed = normalized.replace(/-+/g, "-").replace(/^\.+/, "");
  const safe = collapsed.slice(0, 120).replace(/^[-.]+|[-.]+$/g, "");

  return safe || "file";
}

function getAttachmentKind(mimeType: string): "image" | "file" {
  return mimeType.startsWith("image/") ? "image" : "file";
}

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function buildAttachmentUrl(request: { protocol: string; headers: { host?: string } }, base: string): string {
  if (isAbsoluteHttpUrl(base)) {
    return base;
  }

  const host = request.headers.host;
  if (!host) {
    return `${request.protocol}://localhost${base}`;
  }

  return `${request.protocol}://${host}${base}`;
}

function resolveUploadPath(uploadsDir: string, relativePath: string): string | null {
  const root = resolve(uploadsDir);
  const target = resolve(root, relativePath);
  const pathFromRoot = relative(root, target);

  if (pathFromRoot.startsWith("..") || pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`)) {
    return null;
  }
  if (pathFromRoot.length === 0) {
    return null;
  }

  return target;
}

function getContentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export const uploadsRoutes: FastifyPluginAsync<UploadsRoutesOptions> = async (app, options) => {
  await app.register(multipart, {
    limits: {
      files: 1
    }
  });

  const basePath = options.uploadsPublicBasePath.replace(/\/+$/, "");

  if (!isAbsoluteHttpUrl(basePath)) {
    app.get(`${basePath}/*`, async (request, reply) => {
      const params = request.params as { "*": string };
      const filePath = resolveUploadPath(options.uploadsDir, params["*"]);

      if (!filePath) {
        return reply.code(404).send({ error: "upload not found" });
      }

      try {
        const stats = statSync(filePath);
        if (!stats.isFile()) {
          return reply.code(404).send({ error: "upload not found" });
        }

        return reply
          .type(getContentType(filePath))
          .header("content-length", stats.size)
          .send(createReadStream(filePath));
      } catch {
        return reply.code(404).send({ error: "upload not found" });
      }
    });
  }

  app.post("/api/uploads", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "multipart file field 'file' is required" });
    }

    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const id = randomUUID();
    const originalName = file.filename || "file";
    const safeName = sanitizeFilename(originalName);
    const storedName = `${id}-${safeName}`;
    const dirPath = join(options.uploadsDir, year, month);
    const filePath = join(dirPath, storedName);

    try {
      const content = await file.toBuffer();
      mkdirSync(dirPath, { recursive: true });
      writeFileSync(filePath, content);

      const absoluteBaseUrl = buildAttachmentUrl(
        { protocol: request.protocol, headers: { host: request.headers.host } },
        basePath
      );

      return reply.code(201).send({
        attachment: {
          id,
          messageId: "",
          kind: getAttachmentKind(file.mimetype),
          url: `${absoluteBaseUrl}/${year}/${month}/${storedName}`,
          name: originalName,
          mimeType: file.mimetype,
          sizeBytes: content.byteLength
        },
        originalName,
        mimeType: file.mimetype,
        sizeBytes: content.byteLength
      });
    } catch (error) {
      app.log.error({ error }, "upload persistence failed");
      return reply.code(500).send({ error: "upload persistence failed" });
    }
  });
};
