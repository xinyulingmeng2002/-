import Fastify from "fastify";
import { join } from "node:path";

import { BridgeService } from "./domain/bridges/bridge-service";
import { createBridgeSessionStore } from "./domain/bridges/bridge-session-store";
import { createBridgeTokenStore } from "./domain/bridges/bridge-token-store";
import { createEventLogStore } from "./domain/messages/event-log-store";
import { MessageService } from "./domain/messages/message-service";
import { createRoomSummaryStore } from "./domain/memory/room-summary-store";
import { createWorkMemoryStore } from "./domain/memory/work-memory-store";
import { createParticipantStore } from "./domain/participants/participant-store";
import { createRoomStore } from "./domain/rooms/room-store";
import { createSpaceStore } from "./domain/spaces/space-store";
import { registerRoomRealtimeGateway } from "./realtime/socket";
import { bridgeIngressRoutes } from "./routes/bridge-ingress";
import { bridgeSessionsRoutes } from "./routes/bridge-sessions";
import { bridgeTokensRoutes } from "./routes/bridge-tokens";
import { healthRoutes } from "./routes/health";
import { messagesRoutes } from "./routes/messages";
import { participantsRoutes } from "./routes/participants";
import { roomSummariesRoutes } from "./routes/room-summaries";
import { roomsRoutes } from "./routes/rooms";
import { spacesRoutes } from "./routes/spaces";
import { uploadsRoutes } from "./routes/uploads";

export interface BuildServerOptions {
  dataDir?: string;
  uploadsPublicBasePath?: string;
  now?: () => Date;
}

export function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify();
  const rootDataDir = options.dataDir ?? process.cwd();
  const now = options.now ?? (() => new Date());
  const spaceStore = createSpaceStore(options.dataDir);
  const roomStore = createRoomStore(options.dataDir);
  const participantStore = createParticipantStore(options.dataDir);
  const bridgeTokenStore = createBridgeTokenStore(options.dataDir, now);
  const bridgeSessionStore = createBridgeSessionStore(options.dataDir);
  const eventLogStore = createEventLogStore(options.dataDir);
  const roomSummaryStore = createRoomSummaryStore(options.dataDir);
  const workMemoryStore = createWorkMemoryStore(options.dataDir);
  const messageService = new MessageService({ eventLogStore, workMemoryStore, roomSummaryStore, now });
  const bridgeService = new BridgeService({
    bridgeTokenStore,
    bridgeSessionStore,
    participantStore,
    messageService,
    now
  });

  app.register(healthRoutes);
  app.register(spacesRoutes, { spaceStore });
  app.register(roomsRoutes, { roomStore });
  app.register(participantsRoutes, { participantStore });
  app.register(bridgeTokensRoutes, { bridgeTokenStore });
  app.register(bridgeSessionsRoutes, { bridgeSessionStore, now });
  app.register(bridgeIngressRoutes, { bridgeService });
  app.register(messagesRoutes, { messageService });
  app.register(roomSummariesRoutes, { roomSummaryStore });
  app.register(uploadsRoutes, {
    uploadsDir: join(rootDataDir, "data", "uploads"),
    uploadsPublicBasePath: options.uploadsPublicBasePath ?? "/uploads"
  });
  registerRoomRealtimeGateway(app);

  return app;
}
