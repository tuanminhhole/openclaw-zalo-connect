<div align="center">

# 🦞 OpenClaw Zalo Connect

### Kết nối nhiều tài khoản Zalo cá nhân với nhiều AI agent trong cùng một OpenClaw

*Mỗi tài khoản có session, API client, listener và tuyến phản hồi riêng — đăng nhập QR, chạy đồng thời, không cần Zalo OA.*

<p align="center">
  <a href="https://github.com/tuanminhhole/openclaw-zalo-connect/releases/tag/v3.0.1"><img src="https://img.shields.io/badge/RELEASE-v3.0.1-0EA5E9?style=for-the-badge" alt="Version 3.0.1" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-success?style=for-the-badge" alt="MIT License" /></a>
  <a href="https://openclaw.ai"><img src="https://img.shields.io/badge/OpenClaw-%E2%89%A52026.5.7-7C3AED?style=for-the-badge" alt="OpenClaw 2026.5.7+" /></a>
  <a href="https://github.com/tuanminhhole/openclaw-zalo-connect/stargazers"><img src="https://img.shields.io/github/stars/tuanminhhole/openclaw-zalo-connect?style=for-the-badge&color=eab308&logo=github&logoColor=white" alt="GitHub Stars" /></a>
</p>

> Một Zalo cho bán hàng, một Zalo cho vận hành, một Zalo cho cộng đồng — mỗi tài khoản có thể gắn với một agent, tính cách và workspace khác nhau nhưng vẫn chạy chung một OpenClaw Gateway.

</div>

---

<div align="center">
  <a href="https://www.youtube.com/watch?v=hPusYX-5Pmw">
    <img src="https://img.youtube.com/vi/hPusYX-5Pmw/maxresdefault.jpg" alt="Xem video hướng dẫn OpenClaw và Zalo" width="820" />
  </a>
  <br />
  <strong>▶ Xem video hướng dẫn OpenClaw + Zalo trên YouTube</strong>
</div>

---

## ✨ Vì sao có OpenClaw Zalo Connect?

Các plugin Zalo cá nhân ban đầu đã chứng minh `zca-js` có thể kết nối Zalo với
OpenClaw. OpenClaw Zalo Connect tiếp tục nền tảng đó theo hướng một **channel
runtime được duy trì lâu dài cho hệ sinh thái OpenClaw**, tập trung vào vận hành
đa agent, cài đặt ổn định và khả năng phối hợp với plugin khác.

### Những cải tiến nổi bật trong v3.0.0

- 👥 **Multi-account thật, phục vụ multi-agent** — chạy nhiều tài khoản Zalo cá
  nhân cùng lúc trong một gateway. Mỗi `accountId` có credential, API instance,
  listener, keepalive và outbound route riêng.
- 🧭 **Định tuyến đúng agent** — binding `channel + accountId → agentId` bảo đảm
  tin nhắn của từng tài khoản đi vào đúng agent/workspace, không dùng chung ngữ
  cảnh hoặc gửi nhầm từ tài khoản khác.
- 📦 **Bản cài self-contained** — `zca-js` và các thư viện JavaScript cần thiết
  được bundle vào `dist`; cài từ Git không còn phải chạy `npm install` bổ sung
  hay gặp lỗi thiếu module lúc gateway khởi động.
- ⚡ **Bridge service v2 cho plugin sibling** — Zalo Mod và các plugin OpenClaw
  khác có thể đọc trạng thái, thực thi action, nhận inbound event và đổi group
  policy trực tiếp mà không patch file runtime.
- 🕊️ **Free / Silent / Mute trước model** — runtime group policy có thể chặn tin
  không phù hợp ngay tại inbound pipeline, trước khi dispatch tới AI và trước khi
  tốn token.
- 🧠 **Passive context cho hội thoại nhóm** — thu thập ngữ cảnh nhóm zero-token;
  khi người dùng gọi bot sau một đoạn chat im lặng, plugin tích hợp có thể đưa
  phần liên quan vào lượt trả lời thay vì để agent “mới thức dậy”.
- 🏷️ **Mention Zalo native** — nhận biết mention bot, reply mention đúng UID và
  chuyển `@Tên`/`@[Tên đầy đủ]` thành mention thật khi gửi vào nhóm.
- 🧵 **Inbound ổn định hơn** — queue theo từng cuộc trò chuyện, chống message
  trùng, giới hạn concurrency, timeout, bỏ message quá cũ và keepalive riêng cho
  từng tài khoản.
- 🛡️ **Kiểm soát truy cập nhiều lớp** — DM/group policy, allow/deny theo user,
  mention gate, injection guard, URL validation và sandbox cho file local.
- 🧰 **149 Zalo actions** — nhắn tin, media, reaction, bạn bè, nhóm, poll,
  reminder, profile, quick message, auto-reply, catalog và nhiều thao tác khác.

### Khác gì so với nền tảng `zaloclaw` tại thời điểm fork?

| Hạng mục | Nền tảng ban đầu | OpenClaw Zalo Connect v3 |
|---|---|---|
| Tài khoản trong một gateway | Một client/session dùng chung | Nhiều session và client độc lập theo `accountId` |
| Định tuyến nhiều agent | Cấu hình account cơ bản | Binding account → agent, inbound/outbound tách biệt |
| Cài trực tiếp từ Git | Cần dependency runtime bên ngoài | Bundle self-contained, không cần cài dependency sau đó |
| Tích hợp plugin khác | Import nội bộ hoặc tùy biến riêng | Bridge service v2 có contract ổn định |
| Group policy tức thời | Chủ yếu dựa vào config/reload | Free/Silent/Mute trong RAM, chặn trước model |
| Ngữ cảnh khi bot đang silent | Tin không xử lý thường bị mất khỏi lượt sau | Passive buffer zero-token, có thể inject khi bot được gọi |
| Reply/mention nhóm | Text hoặc xử lý tùy phiên bản | Native UID mention và reply mention |
| Xử lý inbound | Listener trực tiếp | Queue theo thread, dedup, timeout và concurrency guard |
| Định vị sản phẩm | Plugin Zalo cá nhân tổng quát | Channel runtime cho hệ sinh thái OpenClaw đa agent |

> Bảng trên mô tả khác biệt tại thời điểm dự án được fork và phát triển thành
> v3.0.1. Dự án gốc có thể tiếp tục thay đổi độc lập.

---

## 🚀 Cài đặt nhanh

### Cách 1 — Dùng OpenClaw Setup (khuyên dùng)

[OpenClaw Setup](https://github.com/tuanminhhole/openclaw-setup) tự tải đúng
release, tạo channel/binding và hiển thị QR đăng nhập ngay trên giao diện:

```bash
npx create-openclaw-bot
```

Trong dashboard, chọn **Zalo cá nhân** khi tạo bot hoặc bấm **Đăng nhập Zalo**.
Nếu plugin đã có, Setup sẽ dùng lại thay vì tải lại mỗi lần login/restart.

### Cách 2 — Cài trực tiếp release từ Git

Yêu cầu máy đã có [Git](https://git-scm.com/downloads), Node.js 22+ và OpenClaw:

```bash
git clone --depth 1 --branch v3.0.1 \
  https://github.com/tuanminhhole/openclaw-zalo-connect.git

openclaw plugins install ./openclaw-zalo-connect
openclaw gateway restart
openclaw channels login --channel zalo-connect --account default
```

Không cần chạy `npm install`: release chứa sẵn bundle runtime hoàn chỉnh.

### Cách 3 — Link source để phát triển

```bash
git clone https://github.com/tuanminhhole/openclaw-zalo-connect.git
cd openclaw-zalo-connect
npm install
npm run build
openclaw plugins install --link .
openclaw gateway restart
```

### Đăng nhập QR

1. Chạy lệnh login hoặc mở QR trong OpenClaw Setup.
2. Trên Zalo mobile, mở **Trang cá nhân → biểu tượng QR**.
3. Quét mã và xác nhận đăng nhập trên điện thoại.
4. Restart gateway nếu OpenClaw yêu cầu.

```bash
# Tài khoản mặc định
openclaw channels login --channel zalo-connect --account default

# Tài khoản thứ hai
openclaw channels login --channel zalo-connect --account mkt
```

---

## 👥 Chạy nhiều Zalo cá nhân với nhiều agent

Ví dụ hai tài khoản Zalo chạy đồng thời và đi vào hai agent khác nhau:

```jsonc
{
  "channels": {
    "zalo-connect": {
      "enabled": true,
      "defaultAccount": "default",
      "dmPolicy": "open",
      "groupPolicy": "open",
      "accounts": {
        "default": { "enabled": true, "name": "Williams 2" },
        "mkt":     { "enabled": true, "name": "MKT" }
      }
    }
  },
  "bindings": [
    {
      "agentId": "williams-2",
      "match": { "channel": "zalo-connect", "accountId": "default" }
    },
    {
      "agentId": "mkt",
      "match": { "channel": "zalo-connect", "accountId": "mkt" }
    }
  ]
}
```

Credential được lưu tách biệt:

```text
~/.openclaw/zalo-connect-credentials.json       # account default
~/.openclaw/zalo-connect-credentials-mkt.json   # account mkt
```

Kiểm tra trạng thái:

```bash
openclaw channels status --json
```

Mỗi account phải hiện `configured: true`, `running: true` và không có
`lastError`.

---

## ⚙️ Cấu hình channel

File `~/.openclaw/openclaw.json`:

```jsonc
{
  "channels": {
    "zalo-connect": {
      "enabled": true,
      "dmPolicy": "pairing",       // pairing | allowlist | open | disabled
      "allowFrom": [],
      "groupPolicy": "allowlist", // allowlist | open | disabled
      "groups": {
        "*":          { "enabled": false, "requireMention": true },
        "<group_id>": { "enabled": true,  "requireMention": true }
      }
    }
  }
}
```

Khuyến nghị khi mới cài:

- Dùng `dmPolicy: "pairing"` thay vì mở toàn bộ DM.
- Dùng `groupPolicy: "allowlist"` và chỉ bật các group cần thiết.
- Bật `requireMention` nếu bot không cần phản hồi mọi tin nhắn nhóm.
- Không chia sẻ file credential hoặc commit nó lên Git.

---

## 🧠 Passive Collector — nhớ ngữ cảnh nhóm mà không tốn token

Passive Collector ghi message nhóm vào JSONL local. Việc thu thập không gọi
model và không cần Elasticsearch hay dịch vụ bên ngoài:

```jsonc
{
  "plugins": {
    "entries": {
      "zalo-connect": {
        "config": {
          "passiveCollector": { "enabled": true }
        }
      }
    }
  }
}
```

```text
~/.openclaw/workspace/zalo-connect/passive/<groupId>.jsonl
```

Agent có thể đọc lại bằng action `recall-group-history`, hỗ trợ `groupId`,
`query` và `count`.

Khi dùng cùng [OpenClaw Zalo Mod](https://github.com/tuanminhhole/openclaw-zalo-mod),
inbound bridge còn có thể giữ đoạn chat khi group ở Silent Mode và bổ sung phần
liên quan vào lượt người dùng tag bot sau đó.

---

## 🧰 Tính năng và 149 actions

| Nhóm | Khả năng nổi bật |
|---|---|
| 💬 Nhắn tin | Text, styled text, link, ảnh, file, video, voice, sticker, recall, forward |
| 👥 Nhóm | Tạo/đổi tên/giải tán, thành viên, admin, owner, group link, pending member |
| 🤝 Bạn bè | Tìm user, kết bạn, chấp nhận/từ chối, nickname, trạng thái online |
| 🗳️ Poll & reminder | Tạo poll, vote, khóa poll, thêm lựa chọn, tạo/sửa/xóa reminder |
| ⚙️ Hội thoại | Mute, pin, unread, archive, auto-delete, quick message, auto-reply |
| 👤 Tài khoản | Profile, avatar, QR, settings, active status |
| 🛍️ Tiện ích | Note, board, catalog, product, bank card, report |
| 🤖 AI-native | Mention gate, quote context, typing, image buffer, passive history |

Danh sách tham số và ví dụ đầy đủ: **[docs/actions.md](docs/actions.md)**

Hướng dẫn chi tiết: **[docs/guide.md](docs/guide.md)**

---

## 🔌 Bridge service v3

Zalo Connect expose một contract nhỏ cho plugin cùng process:

```text
getStatus(accountId)
listActions(accountId)
executeAction(accountId, action)
setGroupPolicy(accountId, groupId, mode)
getGroupPolicy(accountId, groupId)
clearGroupPolicy(accountId, groupId)
subscribeInbound(handler)
```

Handler inbound có thể trả `true` hoặc `{ handled: true }` để xác nhận đã xử lý
tin nhắn trước mention gate. Nhờ đó slash command chạy tức thì, không gọi model và
không phát sinh câu trả lời trùng từ agent.

Bridge giúp [OpenClaw Zalo Mod](https://github.com/tuanminhhole/openclaw-zalo-mod)
thực hiện moderation và đổi Free/Silent/Mute tức thời mà không import file bundle,
không patch `zca-js` và không sửa config cho mỗi lần toggle.

---

## 🏗️ Kiến trúc

```text
Zalo account: default ─┐
                       ├─ Zalo Connect ─ account router ─ OpenClaw bindings ─ agent/workspace
Zalo account: mkt ─────┘        │
                                ├─ access policy + mention gate
                                ├─ thread queue + dedup + timeout
                                ├─ passive collector
                                ├─ bridge service v3
                                └─ 149 actions + outbound sender
```

```text
index.ts                    Plugin + channel + tool registration
src/channel/monitor.ts      Inbound pipeline và listener từng account
src/channel/send.ts         Outbound, media, markdown và native mention
src/client/zalo-client.ts   API client map theo accountId
src/client/credentials.ts   Credential riêng cho từng accountId
src/runtime/bridge.ts       Contract tích hợp plugin sibling
src/tools/tool.ts           149 Zalo actions
```

---

## 🧪 Phát triển và kiểm thử

```bash
npm install
npm run typecheck
npm test
npm run build
```

Bản `v3.0.1` hiện có **115 automated tests** cho parsing, send, bridge, media,
credential và các thành phần an toàn. Multi-account cũng đã được kiểm tra thực
tế với hai Zalo cá nhân chạy đồng thời và tự kết nối lại sau gateway restart.

Xem [CONTRIBUTING.md](CONTRIBUTING.md) nếu muốn gửi PR.

---

## ⚠️ Lưu ý và giới hạn

- Đây là tích hợp **không chính thức**, không liên kết với Zalo hoặc VNG.
- Zalo không cung cấp public API cho tự động hóa tài khoản cá nhân. Plugin dùng
  thư viện reverse-engineered [`zca-js`](https://zca-js.tdung.com/); việc sử
  dụng có thể không phù hợp với điều khoản Zalo và có nguy cơ hạn chế tài khoản.
- Protocol, cookie hoặc QR flow có thể thay đổi khi Zalo cập nhật.
- Gửi quá nhanh hoặc tự động hóa quá mức có thể bị rate limit. Hãy dùng tài
  khoản thử nghiệm, giới hạn tần suất và luôn có người giám sát.

---

## 🙏 Nguồn gốc và ghi công

OpenClaw Zalo Connect bắt đầu từ mã nguồn MIT của
[`monas-team/zaloclaw`](https://github.com/monas-team/zaloclaw). Cảm ơn
`monas-team`, các contributor của dự án gốc và đội ngũ `zca-js` đã xây dựng nền
tảng kết nối ban đầu.

Từ nhánh fork, dự án được thiết kế và duy trì lại bởi
**[tuanminhhole (Kent)](https://github.com/tuanminhhole)** với định danh package,
channel, multi-account runtime, bridge service, inbound pipeline, passive
context, tài liệu và quy trình phát hành riêng cho hệ sinh thái OpenClaw.

Giấy phép MIT và thông báo bản quyền của dự án gốc tiếp tục được giữ trong
[LICENSE](LICENSE).

---

## 🦞 Hệ sinh thái OpenClaw cùng tác giả

### 🚀 Cài đặt và nền tảng

- [openclaw-setup](https://github.com/tuanminhhole/openclaw-setup) — Web UI tạo,
  triển khai và vận hành bot OpenClaw trên Docker.
- [vietbrain](https://github.com/tuanminhhole/vietbrain) — Bộ khung “Bộ Não Thứ
  Hai” tiếng Việt cho Obsidian và AI agent.

### 🔌 Channel và runtime plugin

- **openclaw-zalo-connect** — repo này; channel Zalo cá nhân đa account/đa agent.
- [openclaw-zalo-mod](https://github.com/tuanminhhole/openclaw-zalo-mod) — quản
  trị nhóm Zalo zero-token, slash command, anti-spam, warn và memory.
- [openclaw-fb-messenger](https://github.com/tuanminhhole/openclaw-fb-messenger) —
  channel Facebook Messenger qua webhook và Graph API.
- [openclaw-telegram-multibot-relay](https://github.com/tuanminhhole/openclaw-telegram-multibot-relay) —
  relay, delegation và cron cho đội bot Telegram.
- [openclaw-browser-automation](https://github.com/tuanminhhole/openclaw-browser-automation) —
  Smart Search và Browser Automation.
- [openclaw-facebook-crawler](https://github.com/tuanminhhole/openclaw-facebook-crawler) —
  thu thập dữ liệu Facebook phục vụ agent workflow.
- [openclaw-n8n-facebook-poster](https://github.com/tuanminhhole/openclaw-n8n-facebook-poster) —
  tự động đăng Facebook qua n8n.

### 🧩 Skill

- [openclaw-skill-learning-memory](https://github.com/tuanminhhole/openclaw-skill-learning-memory) —
  bộ nhớ dài hạn và khả năng tự đóng gói kỹ năng cho agent.
- [openclaw-skill-infographic](https://github.com/tuanminhhole/openclaw-skill-infographic) —
  tạo infographic bằng AI.

---

## 📄 Giấy phép

[MIT](LICENSE) — mã nguồn mở, giữ đầy đủ ghi công và thông báo bản quyền gốc.

<div align="center">

Nếu dự án hữu ích, hãy ⭐ repo để nhiều người trong cộng đồng OpenClaw tìm thấy hơn.

<sub>🦞 <b>OpenClaw Zalo Connect</b> · một phần của hệ sinh thái <a href="https://github.com/tuanminhhole">tuanminhhole (Kent)</a> · không liên kết với Zalo/VNG</sub>

</div>
