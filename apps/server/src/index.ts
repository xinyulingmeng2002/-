import { buildServer } from "./app";
import { getServerConfig } from "./config";

export async function startServer() {
  const app = buildServer();
  const { host, port } = getServerConfig();
  await app.listen({ host, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
