import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { buildServer } from "../apps/server/src/app";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type RoomEvent = {
  eventId: string;
  payload?: {
    messageId?: string;
    body?: string;
    speakerParticipantId?: string;
  };
  attentionTags?: string[];
};

type EventBatch = {
  items?: RoomEvent[];
  nextCursor?: string;
};

const roomId = "room-phase-1d-longrun";
const agentId = "agent-generic-longrun";
const displayName = "Generic Longrun Agent";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ma-phase-1d-longrun-"));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runCommand(command: string, args: string[], options: { cwd: string }): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`command_failed:${command} ${args.join(" ")}\n${stdout}\n${stderr}`));
    });
  });
}

async function waitForOutput(
  child: ChildProcessWithoutNullStreams,
  pattern: RegExp,
  timeoutMs: number
): Promise<string> {
  let output = "";
  const append = (chunk: Buffer) => {
    output += String(chunk);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (pattern.test(output)) {
      child.stdout.off("data", append);
      child.stderr.off("data", append);
      return output;
    }
    await wait(50);
  }

  child.stdout.off("data", append);
  child.stderr.off("data", append);
  throw new Error(`timed_out_waiting_for_output:${pattern}\n${output}`);
}

async function stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGINT");
  const startedAt = Date.now();
  while (child.exitCode === null && child.signalCode === null && Date.now() - startedAt < 5_000) {
    await wait(50);
  }

  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}

function npmBridgeArgs(extra: string[]): string[] {
  return ["--workspace", "@ma/bridge-generic", "run", "dev", "--", ...extra];
}

function parseJsonFromOutput<T>(output: string): T {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error(`phase1d_longrun_json_output_missing:${output}`);
  }

  return JSON.parse(output.slice(start, end + 1)) as T;
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`phase1d_longrun_post_failed:${url}:${response.status}`);
  }

  return (await response.json()) as T;
}

async function uploadFile(baseUrl: string): Promise<{
  attachment: {
    id: string;
    messageId: string;
    kind: "image" | "file" | "link";
    url: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
  };
}> {
  const formData = new FormData();
  formData.append("file", new Blob(["Phase 1D longrun attachment"], { type: "text/plain" }), "longrun.txt");

  const response = await fetch(`${baseUrl}/api/uploads`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error(`phase1d_longrun_upload_failed:${response.status}`);
  }

  return (await response.json()) as {
    attachment: {
      id: string;
      messageId: string;
      kind: "image" | "file" | "link";
      url: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
    };
  };
}

function findEvent(batch: EventBatch, body: string): RoomEvent {
  const event = batch.items?.find((item) => item.payload?.body === body);
  if (!event) {
    throw new Error(`phase1d_longrun_event_missing:${body}`);
  }

  return event;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const tempDir = createTempDir();
  const sessionFilePath = join(tempDir, "generic-session.json");
  const inviteFilePath = join(tempDir, "invite.json");
  let bridgeProcess: ChildProcessWithoutNullStreams | null = null;
  let watchProcess: ChildProcessWithoutNullStreams | null = null;
  const app = buildServer({
    dataDir: tempDir,
    uploadsPublicBasePath: "/uploads"
  });

  try {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("phase1d_longrun_missing_server_address");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const tokenPayload = await postJson<{ invite: unknown }>(`${baseUrl}/api/bridge-tokens`, {
      label: "Generic Phase 1D longrun bridge",
      bridgeKind: "generic",
      allowedRoomIds: [roomId],
      baseUrl
    });
    writeFileSync(inviteFilePath, JSON.stringify(tokenPayload.invite, null, 2), "utf8");

    const baseline = await postJson<RoomEvent>(`${baseUrl}/api/messages`, {
      roomId,
      speakerParticipantId: "human-1",
      body: "Phase 1D longrun baseline"
    });

    bridgeProcess = spawn(
      "npm",
      npmBridgeArgs([
        "session",
        "start",
        "--invite-file",
        inviteFilePath,
        "--agent-id",
        agentId,
        "--display-name",
        displayName,
        "--capabilities",
        "chat,analysis",
        "--session-file",
        sessionFilePath,
        "--heartbeat-ms",
        "1000"
      ]),
      {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    await waitForOutput(bridgeProcess, /generic bridge connected:/, 10_000);

    const agentMessageBody = "Phase 1D longrun agent original";
    const agentMessage = await runCommand(
      "npm",
      npmBridgeArgs(["message", "send", "--session-file", sessionFilePath, "--body", agentMessageBody]),
      { cwd }
    );
    if (!agentMessage.stdout.includes("generic bridge message sent")) {
      throw new Error(`phase1d_longrun_agent_message_unexpected:${agentMessage.stdout}`);
    }

    const listed = await fetch(`${baseUrl}/api/messages?roomId=${roomId}`);
    if (!listed.ok) {
      throw new Error(`phase1d_longrun_list_messages_failed:${listed.status}`);
    }
    const eventsBeforeWatch = (await listed.json()) as { items: RoomEvent[] };
    const agentOriginal = eventsBeforeWatch.items.find((event) => event.payload?.body === agentMessageBody);
    const agentOriginalMessageId = agentOriginal?.payload?.messageId;
    if (!agentOriginalMessageId) {
      throw new Error("phase1d_longrun_agent_original_message_id_missing");
    }

    const structuredMentionBody = "Phase 1D structured mention without at text";
    await postJson<RoomEvent>(`${baseUrl}/api/messages`, {
      roomId,
      speakerParticipantId: "human-1",
      body: structuredMentionBody,
      mentions: [{ participantId: agentId, displayName }]
    });

    const structuredReplyBody = "Phase 1D structured reply without quote text";
    await postJson<RoomEvent>(`${baseUrl}/api/messages`, {
      roomId,
      speakerParticipantId: "human-1",
      body: structuredReplyBody,
      replyToMessageId: agentOriginalMessageId
    });

    const uploaded = await uploadFile(baseUrl);
    const attachmentBody = "Phase 1D attachment message";
    await postJson<RoomEvent>(`${baseUrl}/api/messages`, {
      roomId,
      speakerParticipantId: "human-1",
      body: attachmentBody,
      attachments: [uploaded.attachment]
    });

    watchProcess = spawn(
      "npm",
      npmBridgeArgs([
        "events",
        "watch",
        "--session-file",
        sessionFilePath,
        "--after-event-id",
        baseline.eventId,
        "--format",
        "json",
        "--poll-ms",
        "100",
        "--limit",
        "20"
      ]),
      {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const watchOutput = await waitForOutput(watchProcess, /reply-to-you/, 10_000);
    const batch = parseJsonFromOutput<EventBatch>(watchOutput);

    const mentionEvent = findEvent(batch, structuredMentionBody);
    if (!mentionEvent.attentionTags?.includes("mentioned-you")) {
      throw new Error("phase1d_longrun_missing_mentioned_you_tag");
    }

    const replyEvent = findEvent(batch, structuredReplyBody);
    if (!replyEvent.attentionTags?.includes("reply-to-you")) {
      throw new Error("phase1d_longrun_missing_reply_to_you_tag");
    }

    const attachmentEvent = findEvent(batch, attachmentBody);
    if (!attachmentEvent.payload?.messageId) {
      throw new Error("phase1d_longrun_attachment_message_missing");
    }

    const storedSession = JSON.parse(readFileSync(sessionFilePath, "utf8")) as {
      sessionId?: string;
      agentId?: string;
      roomId?: string;
    };
    if (!storedSession.sessionId || storedSession.agentId !== agentId || storedSession.roomId !== roomId) {
      throw new Error("phase1d_longrun_session_file_invalid");
    }

    console.log("phase1d generic longrun smoke passed");
  } finally {
    if (watchProcess) {
      await stopChild(watchProcess);
    }
    if (bridgeProcess) {
      await stopChild(bridgeProcess);
    }
    await app.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
