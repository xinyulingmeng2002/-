import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { formatCodexBridgeUsage, parseCodexBridgeCliArgs } from "./config";
import { runCodexBridgeSession, sendCodexBridgeMessage, stopCodexBridgeSession } from "./runtime";

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

export async function runCodexBridgeCli(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseCodexBridgeCliArgs(argv, process.env, process.cwd());

  if (parsed.kind === "session.start") {
    const handle = await runCodexBridgeSession(parsed.options);
    console.log(`codex bridge connected: ${handle.session.sessionId}`);
    console.log(`session file: ${handle.session.agentId} -> ${parsed.options.sessionFilePath}`);
    await waitForShutdown(handle.shutdown);
    return;
  }

  if (parsed.kind === "message.send") {
    const body = parsed.options.body ?? (await readStdinBody());
    if (!body) {
      throw new Error("codex_bridge_missing_body");
    }

    await sendCodexBridgeMessage({
      sessionFilePath: parsed.options.sessionFilePath,
      body
    });
    console.log("codex bridge message sent");
    return;
  }

  await stopCodexBridgeSession(parsed.options);
  console.log("codex bridge disconnected");
}

const entryPath = process.argv[1];
const isMainModule = entryPath
  ? import.meta.url === pathToFileURL(resolve(entryPath)).href
  : false;

if (isMainModule) {
  runCodexBridgeCli().catch((error) => {
    console.error(error instanceof Error ? `${error.message}\n\n${formatCodexBridgeUsage()}` : error);
    process.exitCode = 1;
  });
}
