import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { formatWatchBatchAsTranscript } from "@ma/bridge-shared/watch-format";

import { formatGenericBridgeUsage, parseGenericBridgeCliArgs } from "./config";
import {
  getGenericBridgeWorkspaceSnapshot,
  pullGenericBridgeEvents,
  runGenericBridgeSession,
  sendGenericBridgeMessage,
  stopGenericBridgeSession,
  watchGenericBridgeEvents
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

async function waitForShutdown(
  shutdown: () => Promise<void>,
  externalStop?: Promise<void>
): Promise<void> {
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

    const finishWithoutShutdown = () => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      resolvePromise();
    };

    const onSignal = () => {
      void stop();
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    void externalStop?.then(finishWithoutShutdown, rejectPromise);
  });
}

export async function runGenericBridgeCli(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseGenericBridgeCliArgs(argv, process.env, process.cwd());

  if (parsed.kind === "session.start") {
    let resolveExternalStop: (() => void) | undefined;
    const externalStop = new Promise<void>((resolvePromise) => {
      resolveExternalStop = resolvePromise;
    });
    const handle = await runGenericBridgeSession({
      ...parsed.options,
      onSessionFileMissing: resolveExternalStop
    });
    console.log(`generic bridge connected: ${handle.session.sessionId}`);
    console.log(`session file: ${handle.session.agentId} -> ${parsed.options.sessionFilePath}`);
    await waitForShutdown(handle.shutdown, externalStop);
    return;
  }

  if (parsed.kind === "message.send") {
    const body = parsed.options.body ?? (await readStdinBody());
    if (!body) {
      throw new Error("generic_bridge_missing_body");
    }

    await sendGenericBridgeMessage({
      sessionFilePath: parsed.options.sessionFilePath,
      body
    });
    console.log("generic bridge message sent");
    return;
  }

  if (parsed.kind === "workspace.snapshot") {
    const snapshot = await getGenericBridgeWorkspaceSnapshot(parsed.options);
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  if (parsed.kind === "events.pull") {
    const events = await pullGenericBridgeEvents(parsed.options);
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  if (parsed.kind === "events.watch") {
    const abortController = new AbortController();
    const onSignal = () => {
      abortController.abort();
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    try {
      await watchGenericBridgeEvents({
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
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    }
    return;
  }

  await stopGenericBridgeSession(parsed.options);
  console.log("generic bridge disconnected");
}

const entryPath = process.argv[1];
const isMainModule = entryPath ? import.meta.url === pathToFileURL(resolve(entryPath)).href : false;

if (isMainModule) {
  runGenericBridgeCli().catch((error) => {
    console.error(error instanceof Error ? `${error.message}\n\n${formatGenericBridgeUsage()}` : error);
    process.exitCode = 1;
  });
}
