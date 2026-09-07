import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  deleteCredentials,
  hasCredentials,
  loadCredentials,
  saveCredentials,
} from "../src/client/credentials.js";

const originalHome = process.env.HOME;
const originalStateDir = process.env.OPENCLAW_STATE_DIR;
const homes: string[] = [];

afterEach(() => {
  process.env.HOME = originalHome;
  if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
  else process.env.OPENCLAW_STATE_DIR = originalStateDir;
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

/** Nơi phiên Zalo được cất từ 3.1.5: theo state dir của PROJECT, không phải HOME của máy. */
function credentialFile(stateDir: string, suffix = ""): string {
  return join(stateDir, "credentials", "zalo-connect", `credentials${suffix}.json`);
}

describe("multi-account credential storage", () => {
  it("keeps default and named account sessions in separate files", () => {
    const home = mkdtempSync(join(tmpdir(), "zalo-connect-credentials-"));
    homes.push(home);
    process.env.HOME = home;

    saveCredentials({ imei: "default-imei", cookie: [], userAgent: "default-agent" }, "default");
    saveCredentials({ imei: "mkt-imei", cookie: [], userAgent: "mkt-agent" }, "mkt");

    expect(loadCredentials("default")?.imei).toBe("default-imei");
    expect(loadCredentials("mkt")?.imei).toBe("mkt-imei");
    expect(readFileSync(credentialFile(join(home, ".openclaw")), "utf8")).toContain("default-imei");
    expect(readFileSync(credentialFile(join(home, ".openclaw"), "-mkt"), "utf8")).toContain("mkt-imei");

    deleteCredentials("mkt");
    expect(hasCredentials("default")).toBe(true);
    expect(hasCredentials("mkt")).toBe(false);
  });

  it("cất phiên theo OPENCLAW_STATE_DIR, không đá vào phiên của project khác", () => {
    const home = mkdtempSync(join(tmpdir(), "zalo-connect-credentials-"));
    const stateDir = mkdtempSync(join(tmpdir(), "zalo-connect-state-"));
    homes.push(home, stateDir);
    process.env.HOME = home;
    process.env.OPENCLAW_STATE_DIR = stateDir;

    saveCredentials({ imei: "state-imei", cookie: [], userAgent: "agent" }, "default");

    expect(readFileSync(credentialFile(stateDir), "utf8")).toContain("state-imei");
    expect(existsSync(credentialFile(join(home, ".openclaw")))).toBe(false);
  });

  it("dời phiên cũ ở HOME sang state dir một lần, khách khỏi quét lại QR", () => {
    const home = mkdtempSync(join(tmpdir(), "zalo-connect-credentials-"));
    const stateDir = mkdtempSync(join(tmpdir(), "zalo-connect-state-"));
    homes.push(home, stateDir);
    process.env.HOME = home;
    process.env.OPENCLAW_STATE_DIR = stateDir;

    // Giả lập máy khách đã chạy bản cũ: phiên nằm ở ~/.openclaw/zalo-connect-credentials.json
    const legacyDir = join(home, ".openclaw");
    mkdirSync(legacyDir, { recursive: true });
    const legacyPath = join(legacyDir, "zalo-connect-credentials.json");
    writeFileSync(legacyPath, JSON.stringify({ imei: "legacy-imei", cookie: [], userAgent: "legacy-agent" }));

    expect(loadCredentials("default")?.imei).toBe("legacy-imei");
    expect(readFileSync(credentialFile(stateDir), "utf8")).toContain("legacy-imei");
    expect(existsSync(legacyPath)).toBe(false);
    expect(existsSync(`${legacyPath}.migrated`)).toBe(true);
  });
});
