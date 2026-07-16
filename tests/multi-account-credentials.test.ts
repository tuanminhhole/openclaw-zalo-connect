import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deleteCredentials,
  hasCredentials,
  loadCredentials,
  saveCredentials,
} from "../src/client/credentials.js";

const originalHome = process.env.HOME;
const homes: string[] = [];

afterEach(() => {
  process.env.HOME = originalHome;
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe("multi-account credential storage", () => {
  it("keeps default and named account sessions in separate files", () => {
    const home = mkdtempSync(join(tmpdir(), "zalo-connect-credentials-"));
    homes.push(home);
    process.env.HOME = home;

    saveCredentials({ imei: "default-imei", cookie: [], userAgent: "default-agent" }, "default");
    saveCredentials({ imei: "mkt-imei", cookie: [], userAgent: "mkt-agent" }, "mkt");

    expect(loadCredentials("default")?.imei).toBe("default-imei");
    expect(loadCredentials("mkt")?.imei).toBe("mkt-imei");
    expect(readFileSync(join(home, ".openclaw", "zalo-connect-credentials.json"), "utf8")).toContain("default-imei");
    expect(readFileSync(join(home, ".openclaw", "zalo-connect-credentials-mkt.json"), "utf8")).toContain("mkt-imei");

    deleteCredentials("mkt");
    expect(hasCredentials("default")).toBe(true);
    expect(hasCredentials("mkt")).toBe(false);
  });
});
