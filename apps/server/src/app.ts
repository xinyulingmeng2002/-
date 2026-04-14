import Fastify from "fastify";

import { healthRoutes } from "./routes/health";

export function buildServer() {
  const app = Fastify();
  app.register(healthRoutes);
  return app;
}
