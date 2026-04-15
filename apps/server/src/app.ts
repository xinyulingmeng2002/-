import Fastify from "fastify";

import { createRoomStore } from "./domain/rooms/room-store";
import { createSpaceStore } from "./domain/spaces/space-store";
import { registerRoomRealtimeGateway } from "./realtime/socket";
import { healthRoutes } from "./routes/health";
import { roomsRoutes } from "./routes/rooms";
import { spacesRoutes } from "./routes/spaces";

export interface BuildServerOptions {
  dataDir?: string;
}

export function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify();
  const spaceStore = createSpaceStore(options.dataDir);
  const roomStore = createRoomStore(options.dataDir);

  app.register(healthRoutes);
  app.register(spacesRoutes, { spaceStore });
  app.register(roomsRoutes, { roomStore });
  registerRoomRealtimeGateway(app);

  return app;
}
