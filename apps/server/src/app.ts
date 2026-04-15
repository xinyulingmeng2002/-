import Fastify from "fastify";
import { join } from "node:path";

import { createEventLogStore } from "./domain/messages/event-log-store";
import { MessageService } from "./domain/messages/message-service";
import { createWorkMemoryStore } from "./domain/memory/work-memory-store";
import { createRoomStore } from "./domain/rooms/room-store";
import { createSpaceStore } from "./domain/spaces/space-store";
import { registerRoomRealtimeGateway } from "./realtime/socket";
import { healthRoutes } from "./routes/health";
import { messagesRoutes } from "./routes/messages";
import { roomsRoutes } from "./routes/rooms";
import { spacesRoutes } from "./routes/spaces";
import { uploadsRoutes } from "./routes/uploads";

export interface BuildServerOptions {
  dataDir?: string;
  uploadsPublicBasePath?: string;
}

export function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify();
  const rootDataDir = options.dataDir ?? process.cwd();
  const spaceStore = createSpaceStore(options.dataDir);
  const roomStore = createRoomStore(options.dataDir);
  const eventLogStore = createEventLogStore(options.dataDir);
  const workMemoryStore = createWorkMemoryStore(options.dataDir);
  const messageService = new MessageService({ eventLogStore, workMemoryStore });

  app.register(healthRoutes);
  app.register(spacesRoutes, { spaceStore });
  app.register(roomsRoutes, { roomStore });
  app.register(messagesRoutes, { messageService });
  app.register(uploadsRoutes, {
    uploadsDir: join(rootDataDir, "data", "uploads"),
    uploadsPublicBasePath: options.uploadsPublicBasePath ?? "/uploads"
  });
  registerRoomRealtimeGateway(app);

  return app;
}
