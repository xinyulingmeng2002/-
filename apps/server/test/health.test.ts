import { describe, expect, it } from "vitest";

import { buildServer } from "../src/app";
import { getServerConfig } from "../src/config";

describe("health route", () => {
  it("returns ok from /health", async () => {
    const app = buildServer();
    try {
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    } finally {
      await app.close();
    }
  });
});

describe("server config", () => {
  it("allows port zero", () => {
    expect(getServerConfig({ PORT: "0" }).port).toBe(0);
  });
});
