import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { formatWatchBatchAsTranscript } from "@ma/bridge-shared/watch-format";

import { formatOpenClawBridgeUsage, parseOpenClawBridgeCliArgs } from "./config";
import {
  getOpenClawBridgeWorkspaceSnapshot,
  pullOpenClawBridgeEvents,
  runOpenClawBridgeSession,
  sendOpenClawBridgeAttachment,
  sendOpenClawBridgeMessage,
  stopOpenClawBridgeSession,
  watchOpenClawBridgeEvents
} from "./runtime";

async function readStdinBody(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  let body = "";
  for await (const chunk of process.stdin) {
    body += String(chunk);
  }

  return body.trim();
}

async function waitForShutdown(shutdown: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    let finished = false;

    const cleanup = () => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    };

    const stop = async () => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();

      try {
        await shutdown();
        resolvePromise();
      } catch (error) {
        rejectPromise(error);
      }
    };

    const onSignal = () => {
      void stop();
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });
}

export async function runOpenClawBridgeCli(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseOpenClawBridgeCliArgs(argv, process.env, process.cwd());

  if (parsed.kind === "session.start") {
    const handle = await runOpenClawBridgeSession(parsed.options);
    console.log(`openclaw bridge connected: ${handle.session.sessionId}`);
    console.log(`session file: ${handle.session.agentId} -> ${parsed.options.sessionFilePath}`);
    await waitForShutdown(handle.shutdown);
    return;
  }

  if (parsed.kind === "message.send") {
    const body = parsed.options.body ?? (await readStdinBody());
    if (!body) {
      throw new Error("openclaw_bridge_missing_body");
    }

    await sendOpenClawBridgeMessage({
      sessionFilePath: parsed.options.sessionFilePath,
      body
    });
    console.log("openclaw bridge message sent");
    return;
  }

  if (parsed.kind === "events.pull") {
    const events = await pullOpenClawBridgeEvents(parsed.options);
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  if (parsed.kind === "events.watch") {
    const abortController = new AbortController();
    const stop = () => {
      abortController.abort();
    };

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);

    try {
      await watchOpenClawBridgeEvents({
        ...parsed.options,
        signal: abortController.signal,
        onBatch(batch) {
          console.log(
            parsed.options.outputFormat === "transcript"
              ? formatWatchBatchAsTranscript(batch)
              : JSON.stringify(batch)
          );
        }
      });
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
    return;
  }

  if (parsed.kind === "workspace.snapshot") {
    const snapshot = await getOpenClawBridgeWorkspaceSnapshot(parsed.options);
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  if (parsed.kind === "attachment.send") {
    const uploaded = await sendOpenClawBridgeAttachment(parsed.options);
    console.log(JSON.stringify(uploaded, null, 2));
    return;
  }

  await stopOpenClawBridgeSession(parsed.options);
  console.log("openclaw bridge disconnected");
}

const entryPath = process.argv[1];
const isMainModule = entryPath
  ? import.meta.url === pathToFileURL(resolve(entryPath)).href
  : false;

if (isMainModule) {
  runOpenClawBridgeCli().catch((error) => {
    console.error(error instanceof Error ? `${error.message}\n\n${formatOpenClawBridgeUsage()}` : error);
    process.exitCode = 1;
  });
}
