import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildServer } from "./app";
import { getServerConfig } from "./config";

export async function startServer() {
  const app = buildServer();
  const { host, port } = getServerConfig();
  await app.listen({ host, port });
}

const entryPath = process.argv[1];
const isMainModule = entryPath
  ? import.meta.url === pathToFileURL(resolve(entryPath)).href
  : false;

if (isMainModule) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
