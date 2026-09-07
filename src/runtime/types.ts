export type ZaloConnectAccountConfig = {
  enabled?: boolean;
  name?: string;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: Array<string | number>;
  denyFrom?: Array<string | number>;
  groupPolicy?: "open" | "allowlist" | "disabled";
  groups?: Record<
    string,
    {
      allow?: boolean;
      enabled?: boolean;
      requireMention?: boolean;
      allowUsers?: Array<string | number>;
      denyUsers?: Array<string | number>;
      tools?: { allow?: string[]; deny?: string[] };
    }
  >;
  messagePrefix?: string;
  responsePrefix?: string;
  /** Extra name aliases that trigger the bot in groups (besides its Zalo display name). */
  nameTriggers?: string[];
};

export type ZaloConnectConfig = {
  enabled?: boolean;
  name?: string;
  defaultAccount?: string;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: Array<string | number>;
  denyFrom?: Array<string | number>;
  groupPolicy?: "open" | "allowlist" | "disabled";
  groups?: Record<
    string,
    {
      allow?: boolean;
      enabled?: boolean;
      requireMention?: boolean;
      allowUsers?: Array<string | number>;
      denyUsers?: Array<string | number>;
      tools?: { allow?: string[]; deny?: string[] };
    }
  >;
  messagePrefix?: string;
  responsePrefix?: string;
  /** Extra name aliases that trigger the bot in groups (besides its Zalo display name). */
  nameTriggers?: string[];
  accounts?: Record<string, ZaloConnectAccountConfig>;
};

export type ResolvedZaloConnectAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  authenticated: boolean;
  config: ZaloConnectAccountConfig;
};

export type ZaloConnectUserInfo = {
  userId: string;
  displayName: string;
  avatar?: string;
};

export type ZaloConnectFriend = {
  userId: string;
  displayName: string;
  avatar?: string;
};

export type ZaloConnectGroup = {
  groupId: string;
  name: string;
  memberCount?: number;
};

export type ZaloConnectMessage = {
  threadId: string;
  msgId?: string;
  cliMsgId?: string;
  type: number;
  content: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  mentions?: Array<{ uid: string; pos: number; len: number; type: 0 | 1 }>;
  timestamp: number;
  quote?: {
    msg?: string;
    fromId?: string;
    fromName?: string;
    msgId?: string;
    ts?: number;
    /** Raw JSON of the quoted message's attachment (photo/file), when present. */
    attach?: string;
  };
  metadata?: {
    isGroup: boolean;
    groupId?: string;
    senderName?: string;
    fromId?: string;
    /**
     * Tên nhóm đọc thẳng từ payload Zalo của chính tin nhắn này. Có nó thì khung chat hiện
     * "#Tên nhóm" thay vì chuỗi id thô — không phải chờ getGroupInfo (gọi mạng, hay hụt).
     * Kênh chính chủ @openclaw/zalouser làm đúng như vậy: thử lần lượt groupName · gName ·
     * idToName · threadName · roomName ngay trên dữ liệu tin.
     */
    groupName?: string;
  };
};
