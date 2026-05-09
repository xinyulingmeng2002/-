import Fastify from "fastify";
import { join } from "node:path";

import { BridgeService } from "./domain/bridges/bridge-service";
import { createBridgeSessionStore } from "./domain/bridges/bridge-session-store";
import { createBridgeTokenStore } from "./domain/bridges/bridge-token-store";
import { createEventLogStore } from "./domain/messages/event-log-store";
import { MessageService } from "./domain/messages/message-service";
import { createMemoryCandidateStore } from "./domain/memory/memory-candidate-store";
import { MemoryPipelineService } from "./domain/memory/memory-pipeline-service";
import { createPrivateMemoryStore } from "./domain/memory/private-memory-store";
import { MemoryReviewService } from "./domain/memory/memory-review-service";
import { createRoomSummaryStore } from "./domain/memory/room-summary-store";
import { createSharedKnowledgeStore } from "./domain/memory/shared-knowledge-store";
import { createWorkMemoryStore } from "./domain/memory/work-memory-store";
import { createParticipantStore } from "./domain/participants/participant-store";
import { createRoomStore } from "./domain/rooms/room-store";
import { createSpaceStore } from "./domain/spaces/space-store";
import { ObserverService } from "./domain/observer/observer-service";
import { registerRoomRealtimeGateway } from "./realtime/socket";
import { bridgeEgressRoutes } from "./routes/bridge-egress";
import { bridgeIngressRoutes } from "./routes/bridge-ingress";
import { bridgeSessionsRoutes } from "./routes/bridge-sessions";
import { bridgeTokensRoutes } from "./routes/bridge-tokens";
import { healthRoutes } from "./routes/health";
import { memoryCandidatesRoutes } from "./routes/memory-candidates";
import { messagesRoutes } from "./routes/messages";
import { participantsRoutes } from "./routes/participants";
import { privateMemoriesRoutes } from "./routes/private-memories";
import { roomSummariesRoutes } from "./routes/room-summaries";
import { roomsRoutes } from "./routes/rooms";
import { sharedKnowledgeRoutes } from "./routes/shared-knowledge";
import { spacesRoutes } from "./routes/spaces";
import { uploadsRoutes } from "./routes/uploads";
import { workMemoryRoutes } from "./routes/work-memory";

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
  const memoryCandidateStore = createMemoryCandidateStore(options.dataDir);
  const sharedKnowledgeStore = createSharedKnowledgeStore(options.dataDir);
  const privateMemoryStore = createPrivateMemoryStore(options.dataDir, now);
  let messageService!: MessageService;
  const observerService = new ObserverService({
    messageService: {
      listRoomMessages(roomId) {
        return messageService.listRoomMessages(roomId);
      }
    }
  });
  const memoryPipelineService = new MemoryPipelineService({
    observerService,
    memoryCandidateStore,
    privateMemoryStore,
    now
  });
  const memoryReviewService = new MemoryReviewService({
    memoryCandidateStore,
    privateMemoryStore,
    sharedKnowledgeStore,
    workMemoryStore,
    eventLogStore,
    now
  });
  messageService = new MessageService({
    eventLogStore,
    workMemoryStore,
    roomSummaryStore,
    onAfterAppend(event) {
      memoryPipelineService.processEvent(event);
    },
    now
  });
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
  app.register(bridgeEgressRoutes, { bridgeService });
  app.register(bridgeIngressRoutes, { bridgeService });
  app.register(messagesRoutes, { messageService });
  app.register(memoryCandidatesRoutes, { memoryCandidateStore, memoryReviewService });
  app.register(sharedKnowledgeRoutes, { sharedKnowledgeStore });
  app.register(privateMemoriesRoutes, { privateMemoryStore, memoryCandidateStore, memoryReviewService });
  app.register(roomSummariesRoutes, { roomSummaryStore });
  app.register(workMemoryRoutes, { workMemoryStore });
  app.register(uploadsRoutes, {
    uploadsDir: join(rootDataDir, "data", "uploads"),
    uploadsPublicBasePath: options.uploadsPublicBasePath ?? "/uploads"
  });
  registerRoomRealtimeGateway(app);

  return app;
}
