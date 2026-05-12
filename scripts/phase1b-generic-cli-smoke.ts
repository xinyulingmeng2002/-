import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

import { buildServer } from "../apps/server/src/app";

type CommandResult = {
  stdout: string;
  stderr: string;
};

const roomId = "room-cli-smoke";
const agentId = "agent-generic-cli-smoke";
const displayName = "Generic CLI Smoke Agent";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ma-phase-1b-cli-smoke-"));
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
    throw new Error(`phase1b_cli_smoke_json_output_missing:${output}`);
  }

  return JSON.parse(output.slice(start, end + 1)) as T;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const tempDir = createTempDir();
  const sessionFilePath = join(tempDir, "generic-session.json");
  const inviteFilePath = join(tempDir, "invite.json");
  let bridgeProcess: ChildProcessWithoutNullStreams | null = null;
  const app = buildServer({
    dataDir: tempDir,
    uploadsPublicBasePath: "/uploads"
  });

  try {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("phase1b_cli_smoke_missing_server_address");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const tokenCreated = await fetch(`${baseUrl}/api/bridge-tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: "Generic CLI smoke bridge",
        bridgeKind: "generic",
        allowedRoomIds: [roomId],
        baseUrl
      })
    });
    if (!tokenCreated.ok) {
      throw new Error(`phase1b_cli_smoke_token_failed:${tokenCreated.status}`);
    }
    const tokenPayload = (await tokenCreated.json()) as { invite: unknown };
    writeFileSync(inviteFilePath, JSON.stringify(tokenPayload.invite, null, 2), "utf8");

    const humanMessage = await fetch(`${baseUrl}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId,
        speakerParticipantId: "human-1",
        body: "CLI smoke human message"
      })
    });
    if (!humanMessage.ok) {
      throw new Error(`phase1b_cli_smoke_human_message_failed:${humanMessage.status}`);
    }

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

    const message = await runCommand(
      "npm",
      npmBridgeArgs([
        "message",
        "send",
        "--session-file",
        sessionFilePath,
        "--body",
        "Generic CLI smoke agent message"
      ]),
      { cwd }
    );
    if (!message.stdout.includes("generic bridge message sent")) {
      throw new Error(`phase1b_cli_smoke_message_unexpected:${message.stdout}`);
    }

    const workspace = await runCommand(
      "npm",
      npmBridgeArgs(["workspace", "snapshot", "--session-file", sessionFilePath, "--event-limit", "20"]),
      { cwd }
    );
    const workspaceSnapshot = parseJsonFromOutput<{
      room?: { id?: string };
      recentEvents?: Array<{ payload?: { body?: string } }>;
    }>(workspace.stdout);
    if (workspaceSnapshot.room?.id !== roomId) {
      throw new Error("phase1b_cli_smoke_workspace_room_mismatch");
    }
    if (!workspaceSnapshot.recentEvents?.some((event) => event.payload?.body === "Generic CLI smoke agent message")) {
      throw new Error("phase1b_cli_smoke_workspace_missing_agent_message");
    }

    const events = await runCommand(
      "npm",
      npmBridgeArgs(["events", "pull", "--session-file", sessionFilePath, "--limit", "20"]),
      { cwd }
    );
    const eventBatch = parseJsonFromOutput<{
      items?: Array<{ payload?: { body?: string } }>;
    }>(events.stdout);
    if (!eventBatch.items?.some((event) => event.payload?.body === "CLI smoke human message")) {
      throw new Error("phase1b_cli_smoke_events_missing_human_message");
    }

    const storedSession = JSON.parse(readFileSync(sessionFilePath, "utf8")) as {
      sessionId?: string;
      agentId?: string;
      roomId?: string;
    };
    if (!storedSession.sessionId || storedSession.agentId !== agentId || storedSession.roomId !== roomId) {
      throw new Error("phase1b_cli_smoke_session_file_invalid");
    }

    console.log("phase1b generic cli smoke passed");
  } finally {
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
