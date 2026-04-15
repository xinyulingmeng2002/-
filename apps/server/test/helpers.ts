import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/app";

export function createTempDir(prefix = "ma-server-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function cleanupTempDir(dirPath: string): void {
  rmSync(dirPath, { recursive: true, force: true });
}

export interface TestServerHandle {
  server: FastifyInstance;
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServerHandle> {
  const dataDir = createTempDir();
  const server = buildServer({ dataDir });
  await server.listen({ host: "127.0.0.1", port: 0 });

  const address = server.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine test server address");
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await server.close();
      cleanupTempDir(dataDir);
    }
  };
}
