import { describe, expect, it } from "vitest";
import { createBridgeService, exposeBridgeService } from "../src/runtime/bridge.js";
import { ACTIONS } from "../src/tools/tool.js";

describe("plugin bridge service", () => {
  it("reports status without an authenticated session", async () => {
    const bridge = createBridgeService();
    const status = await bridge.getStatus();
    expect(status.channel).toBe("zaloclaw");
    expect(typeof status.connected).toBe("boolean");
  });

  it("lists the same actions as the agent tool", async () => {
    const bridge = createBridgeService();
    const actions = await bridge.listActions();
    expect(actions).toEqual([...ACTIONS]);
    expect(actions).toContain("send");
    expect(actions.length).toBeGreaterThan(100);
    // returned array is a copy — mutating it must not affect the tool
    actions.pop();
    expect((await bridge.listActions()).length).toBe(ACTIONS.length);
  });

  it("rejects an action without a name", async () => {
    const bridge = createBridgeService();
    await expect(bridge.executeAction(undefined, {} as never)).rejects.toThrow(/missing action name/);
  });

  it("surfaces tool-level errors as structured results, not throws", async () => {
    const bridge = createBridgeService();
    // no session is logged in during tests → the tool reports an error payload
    const result = (await bridge.executeAction(undefined, { action: "me" })) as {
      error?: boolean;
      message?: string;
    };
    expect(result?.error).toBe(true);
    expect(typeof result?.message).toBe("string");
  });

  it("exposes the service on the documented global handshake", () => {
    const service = exposeBridgeService();
    expect((globalThis as Record<string, unknown>).__zaloclawBridgeService).toBe(service);
    expect(service.version).toBe(1);
    delete (globalThis as Record<string, unknown>).__zaloclawBridgeService;
  });
});
