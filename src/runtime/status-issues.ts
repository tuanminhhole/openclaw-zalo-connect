import { hasStoredCredentials } from "../client/zalo-client.js";
import type { ChannelStatusIssue } from "openclaw/plugin-sdk/channel-contract";

export function collectZaloConnectStatusIssues(): ChannelStatusIssue[] {
  const issues: ChannelStatusIssue[] = [];

  if (!hasStoredCredentials()) {
    issues.push({
      channel: "zalo-connect",
      accountId: "default",
      kind: "auth",
      message: "zalo-connect: not logged in (no credentials — run: openclaw channels login zalo-connect)",
    });
  }

  return issues;
}
