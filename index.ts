import type { AnyAgentTool, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { zaloConnectPlugin } from "./src/channel/channel.js";
import { exposeBridgeService } from "./src/runtime/bridge.js";
import { setZaloConnectRuntime } from "./src/runtime/runtime.js";
import { ZaloConnectToolSchema, executeZaloConnectTool } from "./src/tools/tool.js";

const plugin = {
  id: "zalo-connect",
  name: "OpenClaw Zalo Connect",
  description: "Zalo personal account messaging via zca-js library",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setZaloConnectRuntime(api.runtime);
    // Register channel plugin (for onboarding & gateway)
    api.registerChannel({ plugin: zaloConnectPlugin });

    // Register agent tool
    api.registerTool({
      name: "zalo-connect",
      label: "Zalo Connect",
      description:
        "Complete Zalo personal account management via zca-js (149 actions). " +
        "Messaging: send, image, link, send-to-stranger, send-video, send-voice, send-sticker, send-card, send-bank-card, " +
        "delete-message, undo-message (recall), forward-message, add-reaction, send-typing. " +
        "Friend: find-user, send-friend-request, accept/reject-friend-request, get-sent/friend-requests, " +
        "undo-friend-request, unfriend, check-friend-status, set/remove-friend-nickname, get-online-friends, " +
        "get-friend-recommendations, get-alias-list, get-related-friend-groups. " +
        "Groups: list/search-groups, get-group-info, create-group, add/remove-to/from-group, leave-group, " +
        "rename-group, add/remove-group-admin, change-group-owner, disperse-group, update-group-settings, " +
        "enable/disable/get-group-link, get/review-pending-members, " +
        "get-group-blocked, block/unblock-group-member, get-group-members-info, " +
        "join-group-link, invite-to-groups, get-group-invites, join/delete-group-invite. " +
        "Polls: create-poll, vote-poll, lock-poll, get-poll-detail, add-poll-options, share-poll. " +
        "Reminders: create/remove/edit-reminder, list-reminders. " +
        "Conversation: mute/unmute/pin/unpin-conversation, delete-chat, hide/unhide-conversation, " +
        "get-hidden-conversations, mark/unmark-unread, get-unread-marks, " +
        "set-auto-delete-chat, get-auto-delete-chats, get-archived-chats. " +
        "Quick Messages: list/add/remove/update-quick-message. " +
        "Auto-Reply: list/create/update/delete-auto-reply. " +
        "Profile: me, get-user-info, last-online, get-qr, update-profile, " +
        "change-avatar, delete-avatar, get-avatar-list, reuse-avatar. " +
        "Settings: get-settings, update-setting, update-active-status. " +
        "Notes: create-note, edit-note, get-boards, get-labels. " +
        "Catalogs: create/update/delete-catalog, get-catalogs, create/update/delete-product, get-products. " +
        "Block: block/unblock-user (OpenClaw), zalo-block/unblock-user (Zalo-level), block-view-feed. " +
        "Misc: search-stickers, parse-link, send-report, get-biz-account. " +
        "Names are auto-resolved to IDs.\n\n" +
        "HOW TO USE — conventions: `threadId` = the chat to act on. In the CURRENT group use the RAW groupId " +
        "(NO `g:` prefix) with `isGroup:true`; in a 1-1 DM use the userId with `isGroup:false`. After acting, " +
        "reply briefly to the user — do NOT paste raw JSON/results. Be proactive: use these when it fits " +
        "(user asks for a sticker, a poll, a reminder, a pinned note, etc.).\n" +
        "Recipes: sticker → `send-sticker {threadId,isGroup,keyword:'<mood>'}` (auto-finds & sends; or specify " +
        "`stickerId`+`stickerCateId`). reaction → `add-reaction {msgId,icon}` (icon: heart|like|haha|wow|cry|angry). " +
        "poll → `create-poll {threadId,isGroup,title,options:[...],allowMultiChoices?}`. pinned note → " +
        "`create-note {threadId,isGroup,title}`. reminder → `create-reminder {threadId,isGroup,title,startTime:<epochMs>,repeat:0|1|2|3}` " +
        "(0=once,1=day,2=week,3=month; recurring cron-style → use the cron feature instead). media → " +
        "`send-image|send-video|send-voice|send-file|send-link {threadId,isGroup,url|voiceUrl|filePath}`. " +
        "recall the bot's OWN last message → `undo-message {threadId}` — NO msgId needed, it auto-picks the bot's " +
        "most recent message in that thread (only within ~5 minutes; pass `msgId` to target a specific message). " +
        "group admin (bot must be admin) → add/remove-group-admin, rename-group, change-group-owner, " +
        "invite-to-groups, enable/disable/get-group-link, update-group-settings. conversation → pin-conversation, " +
        "mute-conversation `{threadId,duration:-1}`, send-typing `{threadId,isGroup}`.",
      parameters: ZaloConnectToolSchema,
      execute: executeZaloConnectTool,
    } as AnyAgentTool);

    // Expose a stable bridge for sibling plugins (dashboards, moderation
    // layers) to execute actions programmatically — same params as the agent
    // tool. Documented handshake; avoids plugins importing bundled internals.
    exposeBridgeService();
  },
};

export default plugin;
