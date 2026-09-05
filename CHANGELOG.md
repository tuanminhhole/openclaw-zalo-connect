# Nhật ký thay đổi

Tất cả thay đổi đáng chú ý của dự án được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.1.4] - 2026-09-05

### 🚑 Cài từ ClawHub không còn chết giữa chừng

Bản 3.1.3 tải về được nhưng **cài hỏng** trên máy mới: tới bước "Installing plugin dependencies…"
là npm gục sau khoảng hai phút, plugin không vào được, và bot mất luôn kênh Zalo — log gateway
kêu `unknown channel id: zalo-connect`, bấm quét QR thì không ra mã. Đã vấp trên ba máy khách
(hai lần ngày 03/09, một lần ngày 05/09), cả Docker lẫn cài thẳng, Windows lẫn Linux.

Nguyên nhân: gói tải từ ClawHub mang theo danh sách **thư viện dành cho lập trình viên** (dùng để
build và chạy test), mà npm lại vấp chính danh sách đó khi dựng cây phụ thuộc — kể cả khi OpenClaw
đã bảo nó bỏ qua. Từ bản này, gói phát hành **chỉ còn thư viện cần cho lúc chạy**: nhẹ hơn, cài
nhanh hơn, và không còn chỗ cho lỗi đó phát sinh. Mã nguồn không đổi một dòng.

Máy đang chạy 3.1.3 mà cài được rồi thì không cần làm gì. Máy nào cài hỏng: cài lại là xong.

## [3.1.3] - 2026-09-02

### 🚑 Chạy được trên OpenClaw 2026.8 + bot hết chối "không thấy file"

OpenClaw 2026.8 đổi bộ khung cho plugin — bản 3.1.2 **không khởi động được** trên máy đã nâng
cấp (bot mất hẳn kênh Zalo). Bản này sửa cho chạy trên cả 2026.7 lẫn 2026.8, không bắt ai nâng
cấp gấp.

- **File khách gửi qua chat được "chỉ đường" tận nơi cho AI.** Trước đây model yếu tải file về
  xong vẫn nói "em không thấy file" vì đi tìm sai chỗ (có khách gửi một file 9 lần đều bị chối).
  Giờ kênh ghi thẳng vị trí file vào tin nhắn cho AI — model nào cũng thấy.
- **Gắn "máy đo" cho ca tin nhắn file bị rơi link tải** — lần tới gặp là log tự khai nguyên
  nhân, không còn mất dấu.

## [3.1.0] — 2026-08-02

### Thêm mới

- **★ Kéo được LỊCH SỬ chat về, kể cả tin nhắn riêng.** Trước nay chỉ có tin đến từ lúc bot đang
  chạy, nên bất cứ giao diện chat nào dựng lên cũng mở ra một danh sách trống. Zalo có đẩy lại lịch
  sử, chỉ là qua **WebSocket** chứ không qua REST: `listener.requestOldMessages(ThreadType.User)` =
  cmd 510 cho tin riêng, `ThreadType.Group` = cmd 511 cho nhóm.

  Action mới `request-old-messages` với `threadType: user | group | both` (mặc định `both`). Nó trả
  về ngay; Zalo đẩy dần từng lô sau đó.

  Dễ kết luận nhầm là "REST không có API lịch sử DM ⇒ không lấy được" — REST đúng là không có, WS
  thì có. Ghi lại đây để lần sau khỏi đi lại đường cụt đó.
- **Kênh bridge riêng cho lịch sử (contract v5): `subscribeHistory`.** Tách hẳn khỏi
  `subscribeInbound` chứ không thêm một cờ `isHistory`, vì đường inbound đi thẳng vào cổng mention
  rồi dispatch cho model — một lần kéo lịch sử là hàng trăm tin đổ về, lọt vào đó thì **bot trả lời
  hàng loạt tin từ tuần trước, gửi thật vào nhóm khách**. Tách kênh khiến lỗi đó không thể xảy ra do
  nhầm lẫn, thay vì trông chờ ai đó nhớ kiểm cờ.

  Thuận lợi là zca-js vốn đã phát tin cũ trên sự kiện **`old_messages`** riêng, không phải
  `"message"` — nên trước bản này tin cũ chỉ đơn giản bị bỏ qua, chưa từng có rủi ro. Sự kiện lịch
  sử mang thêm `fromSelf` (khung chat cần biết vẽ trái hay phải; đường inbound vốn đã lọc bỏ tin tự
  gửi nên không có thông tin này) và đẩy theo **lô** thay vì từng tin.

- **★ Kênh "đang soạn tin" (contract v6): `subscribeTyping`.** zca-js vốn phát sự kiện `typing`
  nhưng trước nay không ai nghe, nên giao diện chat nào dựng trên bridge cũng thiếu thứ mà người
  dùng Zalo mặc định là phải có. Phát thành **kênh riêng** như đã làm với lịch sử: một sự kiện sống
  đúng 3 giây không nên đi chung đường với tin nhắn thật, vốn phải được lưu.
- **★ Tin bot TỰ GỬI cũng được phát lên bridge (kênh lịch sử, `fromSelf: true`).** Nhánh xử lý
  self-echo trước đây ghi lại `cliMsgId` rồi `return` — đúng cho mục đích chống-vọng ban đầu, nhưng
  hệ quả là bên tiêu thụ chỉ thấy MỘT chiều: câu khách hỏi thì có, câu bot đáp thì không, nên khung
  chat trông như bot chưa từng trả lời. Đi vào kênh lịch sử chứ không phải inbound — inbound dẫn
  thẳng tới model, đẩy tin của chính bot vào đó là mở đường cho vòng lặp tự trả lời chính mình.

### Sửa lỗi

- **★ Mốc thời gian bị nhân 1000 thành micro-giây.** Comment trong `monitor.ts` ghi *"Zalo timestamps
  are seconds"* rồi `* 1000` — nhưng `data.ts` của Zalo **vốn đã là mili-giây** (13 chữ số), nên kết
  quả là micro-giây (16 chữ số). Bên tiêu thụ lưu thẳng vào DB, nên cùng một cột chứa hai đơn vị và
  mọi phép sắp xếp/hiển thị theo thời gian đều sai — khung chat hiện ra **năm 5xxxx**. Nay có
  `normalizeZaloTs()` đoán theo **độ lớn** (giây / mili / micro) thay vì tin vào một đơn vị cố định.
- **★ Tin nhắn RIÊNG không được phát lên bridge.** `publishBridgeInbound` bị bọc trong `if (isGroup)`,
  nên người dùng nhắn thẳng cho bot thì **không plugin nào biết** — khung chat của plugin điều khiển
  chỉ thấy DM đó ở lần kéo lịch sử kế tiếp. Nay phát cho cả hai loại, kèm `isGroup` để bên nhận tự
  quyết xử lý ra sao.

- **★ Trang đầu lịch sử chỉ trả MỘT LẦN mỗi phiên WebSocket — nay nói thẳng thay vì im lặng.** Đo
  trên tài khoản thật: gọi `request-old-messages` lần đầu sau khi kết nối thì Zalo trả 50 tin riêng
  + 50 tin nhóm; gọi lại y hệt trong cùng phiên thì **không có phản hồi nào** — không lỗi, không sự
  kiện, im lặng hoàn toàn. Kiểu im lặng đó khiến người dùng bấm lần hai, không thấy gì, và kết luận
  tính năng hỏng.

  Nay nhớ theo `(profile, loại)` và trả về `skipped` kèm câu chỉ đường (truyền `lastMsgId` để lùi xa
  hơn, hoặc đợi phiên mới). Dấu nhớ được xoá khi listener kết nối lại — thiếu bước đó thì sau một
  lần rớt mạng, action sẽ vĩnh viễn báo "đã lấy rồi".

  Vẫn trả `success: true` khi bỏ qua: đó không phải lỗi, mà là "không còn gì để xin". Trả `false`
  thì phía zalo-mod (`openclaw-adapter` đổi `success:false` thành throw) báo đỏ cho một tình huống
  hoàn toàn bình thường.
- **`request-old-messages` báo lỗi rõ khi WebSocket chưa kết nối.** `listener.sendWs` là
  `if (this.ws) { … }` — mất kết nối thì nó im lặng không làm gì, và action sẽ trả `success: true`
  trong khi không có tin nào được yêu cầu. Nay chặn trước và nói thẳng, thay vì để người gọi ngồi
  chờ một lô tin không bao giờ tới.

## [3.0.18] — 2026-07-30

### Sửa lỗi
- **Ảnh gửi vào nhóm bị bỏ vì header của CDN, không phải vì người gửi.** CDN ảnh của Zalo
  thường xuyên trả ảnh thật với `Content-Type: application/octet-stream`. Xác minh trực
  tiếp trên CDN: một URL đuôi `.jpg` trả `200 application/octet-stream`, 23704 byte, và nội
  dung là JPEG baseline hợp lệ (`ff d8 ff db`, 512x512). `image-downloader` từ chối ngay ở
  header — **trước** cổng magic-byte ở 5 dòng dưới, vốn vừa chặt hơn vừa đúng hơn (nó là
  chỗ bắt trang HTML lỗi của CDN). Trên một máy production, **6/7 ảnh vào bị đánh rơi**, và
  vì cùng một URL luôn fail nên nó trông như *"ảnh của người đó không bao giờ đọc được"*
  thay vì *"header không đáng tin"*.

  Nay header chỉ từ chối kiểu **sai rõ ràng** (`text/*`, json, video, pdf…); kiểu binary
  chung chung hoặc thiếu header thì nhường quyền quyết định cho magic bytes. Thêm nhánh:
  generic + bytes không nhận ra → vẫn từ chối, để việc nới header không thành cửa cho rác.
  Không có thứ gì đang chạy được mà bị siết lại.

### Thêm mới
- **Nhận ảnh HEIC/AVIF (iPhone đời mới).** Hai định dạng này dùng chung container ISO-BMFF
  với MP4 — đều mở đầu bằng độ dài box, rồi `ftyp`, rồi brand 4 ký tự — nên chỉ có **brand**
  phân biệt ảnh với video. Nhận diện theo brand (`heic`/`heix`/`mif1`/`msf1`/`avif`/`avis`…)
  và chỉ theo brand: coi mọi file `ftyp` là ảnh sẽ đẩy hết MP4 vào đường xử lý ảnh. Có test
  chặn đúng 4 brand video (`isom`, `mp42`, `qt  `, `M4V `).
- **Đặt tên file theo bytes thật, không theo URL.** Zalo viết lại mọi URL ảnh thành `.jpg`,
  nên một ảnh HEIC từ iPhone trước đây bị lưu thành `.jpg` và làm sai lệch thứ mở nó sau đó.
  Đuôi file giờ lấy từ định dạng đã nhận diện, chỉ fallback về đuôi URL khi không nhận ra.
  Kiểm tra chống path-traversal vẫn áp lên đường dẫn cuối cùng.

## [3.0.16] — 2026-07-26

### Thêm mới
- **Name-trigger runtime cho chế độ im lặng (bridge v4).** Bot đang `silent`
  (`requireMention`) trả lời khi được @nhắc HOẶC khi tin nhắn gọi đúng tên bot. Ngoài
  tên Zalo tự nhận + alias trong config, nay có thêm lớp **override runtime** đẩy từ
  plugin điều khiển (vd openclaw-zalo-mod): `src/runtime/name-triggers.ts` giữ map
  `accountId → tên gọi[]` trong RAM và được gộp vào cổng name-gate ở `monitor.ts`. Giống
  group-policy: **không ghi `openclaw.json`, không restart** — sửa là ăn ngay ở tin kế
  tiếp; persistence thuộc về caller và replay sau khi gateway restart thật.
- **Bridge service lên v4:** thêm `getNameTriggers(accountId)` (trả tên hiển thị tự nhận +
  danh sách override + tập hiệu lực) và `setNameTriggers(accountId, list)`. Bổ sung thuần
  (v3 giữ nguyên).

## [3.0.13] — 2026-07-25

### Sửa lỗi
- **Không lộ "suy nghĩ"/log chạy tool ra kênh.** Khi model xuất ra một dòng trace
  thực thi tool làm câu trả lời (vd `⚠️ 🛠️ Exec failed: run python3 … → … (agent)`),
  nó bị lọt xuống Zalo. OpenClaw KHÔNG gắn cờ tool-progress cho payload này nên không
  chặn theo cờ được → thêm lọc theo NỘI DUNG: câu trả lời có dạng tool-trace (biểu tượng
  🛠️ + đuôi `(agent)`/`(you)`, hoặc mở đầu `Exec/Tool/Command/Run … failed/error`) sẽ
  **không gửi ra kênh** (vẫn hiện trên gateway/dashboard). Cũng bỏ qua payload có cờ
  `isReasoning`/`isReasoningSnapshot`/`isStatusNotice`/`toolProgress` cho chắc.

## [3.0.12] — 2026-07-24

### Sửa lỗi
- **Bot "ngủm" sau thời gian idle (mất kết nối, gọi không lên).** Watchdog ping/pong
  chỉ reconnect khi mất pong / socket đóng — nhưng Zalo có thể **giữ socket mở + vẫn trả
  lời ping/gửi typing mà NGỪNG đẩy tin** sau idle → bot "khỏe giả", không hồi tới khi
  restart. Thêm **hard refresh định kỳ 25 phút** (tự dựng lại phiên bất kể trạng thái →
  làm tươi session/cookie, chặn mọi kiểu chết-âm-thầm) + **refresh nhanh khi không có
  frame nào trong 8 phút**. Kèm log health định kỳ (readyState/pongAge/frameAge) để chẩn
  đoán về sau.

## [3.0.11] — 2026-07-24

### Tính năng
- **Kích hoạt bằng TÊN (không chỉ @mention) ở chế độ silent:** nhóm yêu cầu mention
  giờ cũng trả lời khi tin nhắn **nhắc đúng tên bot** — tên Zalo hiển thị của bot (tự
  lấy lúc login) hoặc alias khai trong `nameTriggers`. Khớp không dấu, không phân biệt
  hoa/thường, theo từ (alias ngắn không dính vào từ khác). Gate deterministic ở tầng
  transport → bot **không nói leo** khi không được gọi, không phụ thuộc model nhớ luật.
  Chế độ free (không yêu cầu mention) và mute không đổi. Config mới: `nameTriggers`
  (mảng chuỗi) ở cấp channel hoặc từng account.

### Sửa lỗi
- **Tin nhắn lặp đôi khi gửi kèm file:** khi agent gắn file (qua tool `message` của
  OpenClaw → adapter `sendText`/`sendMedia`) và lặp lại đúng đoạn text đó trong câu
  trả lời, tool gửi một lần (không mention) rồi reply pipeline gửi lại (có mention).
  Nay ghi lại text đã gửi qua tool và reply pipeline **bỏ qua** bản trùng (khớp chính
  xác, TTL 90s, chỉ khi reply không tự kèm media). Áp cho cả `send`/`send-styled`/
  `send-file`/`send-image` và adapter `sendText`/`sendMedia`.

### Bảo mật / đóng gói
- **Qua được ClawHub security scan:** build thêm `--define:process.env.NODE_DEBUG=undefined`
  để loại nhánh debug của thư viện `semver` khỏi bundle (mẫu `process.env.NODE_DEBUG`
  bị scanner gắn cờ `suspicious.env_credential_access`). Vô hại về runtime (chỉ là
  debug logger, vốn luôn tắt); không đổi tính năng.

## [3.0.9] — 2026-07-23

### Sửa lỗi
- **Bot gọi bằng TÊN không đọc được ảnh (bất đối xứng đa-account):** cổng xử lý ảnh
  inbound đổi từ `!isGroup || wasMentioned` sang `!isGroup || wasMentioned ||
  !resolvedRequireMention`. Trước đây chỉ tải/đính ảnh khi bot được **@mention** →
  bot ở nhóm `requireMention:false` được gọi bằng tên tuy vẫn trả lời nhưng KHÔNG
  nhận ảnh (vd William được @ thì thấy ảnh, Mkt gọi tên thì không). Khi tin đã qua
  mention gate (đang dispatch cho agent) thì ảnh của chính tin đó phải được xử lý.
  Vẫn chỉ dùng media của tin hiện tại (không merge buffer) để tránh ảnh cũ.

## [3.0.8] — 2026-07-23

### Sửa lỗi
- **Nhiều bot chung một nhóm bị "nuốt" tin của nhau (dedup toàn cục):** khử trùng
  lặp `msgId` trước đây khóa theo `msgId` — mà Zalo giao **cùng một `msgId`** cho
  MỌI tài khoản bot trong nhóm. Tài khoản nào nhận trước "thắng", các tài khoản còn
  lại lặng lẽ bỏ tin → trong nhóm có 2+ bot, mỗi tin chỉ được một bot xử lý và bot
  được gọi thường **không trả lời** ("bot ngủm"). Nay khóa theo `accountId:msgId`,
  mỗi tài khoản khử trùng lặp độc lập (vẫn chặn delivery-mirror của chính nó).
- **Mention bị lặp đôi khi trả lời (`@Tên @Tên …`):** nếu model đã tự mở đầu câu
  trả lời bằng đúng `@Tên` thì không chèn thêm mention thứ hai nữa — chỉ đánh dấu
  token sẵn có thành mention có thể bấm.

### Thay đổi
- **selfListen bật lại (`true`):** cần cho việc thu hồi tin của chính bot (self-echo
  là nguồn `cliMsgId` tin cậy vì API gửi không trả về). Trước đây bị tắt vì nghi gây
  "đói" đa-tài-khoản — thực chất thủ phạm là dedup toàn cục ở trên, nay đã sửa nên
  self-echo chỉ thêm chút tải ws, không hại đa-tài-khoản.
- **Ổn định listener đa-tài-khoản:** watchdog dùng ping/pong ở tầng websocket (socket
  rảnh-mà-khỏe vẫn trả lời ping nên không còn reconnect nhầm khi nhóm im), giãn ~6s
  khi mở tài khoản non-default, và reconnect bằng phiên/`api` mới thay vì khởi động
  lại listener đã chết.

## [3.0.7] — 2026-07-22

### Sửa lỗi
- **Đọc ảnh inbound trong Docker:** thư mục tải media inbound giờ resolve từ
  `OPENCLAW_HOME` (fallback `~/.openclaw`) thay vì `os.homedir()+".openclaw"`.
  Trong container OpenClaw đặt `HOME` = chính thư mục `.openclaw`, nên cách cũ tạo
  path lặp `…/.openclaw/.openclaw/media/inbound` — nằm NGOÀI thư mục media mà tool
  `image` của core cho phép → agent báo "không xem được ảnh". Nay tải về đúng
  `<OPENCLAW_HOME>/media/inbound`. Áp dụng cho `image-downloader`, `file-downloader`
  và `thread-sandbox` (workspace/media allowlist) để đồng bộ.

## [3.0.6] — 2026-07-22

### Sửa lỗi
- **Hết cảnh báo `legacy-root-sdk-import`:** `index.ts` chuyển từ barrel gốc
  `openclaw/plugin-sdk` sang subpath `openclaw/plugin-sdk/plugin-entry`
  (`AnyAgentTool`, `OpenClawPluginApi`, `emptyPluginConfigSchema`). Plugin
  Inspector sạch, không còn cảnh báo khi publish lên ClawHub.

### Ghi chú
- Gộp và đưa lên ClawHub `latest` toàn bộ cải tiến 3.0.2→3.0.5 vốn đã đăng ký
  version nhưng con trỏ `latest` chưa nhích: đọc/phân tích ảnh từ tin **quote**
  (`quote.attach` → tải + đính media), **thu hồi tin của bot** đáng tin cậy
  (`undo-message` bắt `cliMsgId` thật qua selfListen echo + `threadId`/ThreadType),
  và cookbook action zalo-connect nhúng thẳng vào mô tả tool.

## [3.0.0] — 2026-07-17

### Sửa lỗi sau phát hành
- Đóng gói `dist` self-contained để cài trực tiếp từ Git không còn lỗi thiếu
  `zca-js` hoặc phải chạy `npm install` thủ công.
- Hoàn thiện multi-account thực: mỗi `accountId` có credential, API client,
  listener, keepalive và outbound route riêng; tài khoản `default` và các tài
  khoản đặt tên có thể chạy đồng thời trong cùng gateway.
- Đồng bộ tài liệu cài đặt, số action thực tế, chính sách bảo mật và các liên kết
  public; tài liệu kỹ thuật vận hành được tách khỏi repo công khai.

### Breaking change
- Đổi thương hiệu maintained fork thành **OpenClaw Zalo Connect**.
- Đổi package thành `openclaw-zalo-connect`, plugin/channel/tool thành
  `zalo-connect`.
- Thêm bridge service v2 cho live group policy, passive context và native reply
  mention chính xác theo UID.
- Giữ giấy phép MIT và ghi công dự án gốc `monas-team/zaloclaw`.

### Thêm mới
- **Passive inbound bridge**: thêm `subscribeInbound` và phát tin group đã qua
  access gate nhưng trước Silent mention gate. Plugin sibling có thể lưu context
  zero-token; timestamp được chuẩn hoá sang millisecond. Với lượt chỉ tag bot,
  prompt dùng tin liên quan gần nhất trong buffer thay vì phản hồi như phiên mới.
- **Bridge service v2 — live group policy**: sibling plugins có thể gọi
  `setGroupPolicy(accountId, groupId, 'free'|'silent'|'mute')`. Policy được giữ
  trong RAM và đọc trực tiếp bởi inbound monitor: `silent` chặn tin không tag,
  `mute` drop cả group trước dispatch/model. Không ghi `openclaw.json`, không
  kích hoạt config-reload hay gateway restart. Caller chịu trách nhiệm persist
  và replay policy sau restart.

## [2.4.5] — 2026-07-09

### Tài liệu
- **CHANGELOG**: Bổ sung đầy đủ entries cho v2.4.1–v2.4.4 — trước đó bị bỏ sót trong quá trình release nhanh
- **openclaw.plugin.json / package.json**: Xác nhận đồng nhất toàn bộ `version`, `compat.pluginApi`, `minGatewayVersion` — tất cả đều là `2.4.5` / `>=2026.5.7`

---

## [2.4.4] — 2026-07-09

### Sửa lỗi
- **package.json / openclaw.plugin.json**: Đồng bộ `minGatewayVersion` lên `>=2026.5.7` — trước đây vẫn ghi `>=2026.2.0` trong khi README/guide đã nói `>=2026.5.7`. Lỗi được phát hiện bởi bé Mi (Ươm Mầm) trong quá trình review tài liệu.

---

## [2.4.3] — 2026-07-09

### Tài liệu
- **docs/guide.md**: Thêm hướng dẫn cài đặt & cấu hình chi tiết từ zero — prerequisites, QR login, config đầy đủ, passive collector, group events, injection guard, troubleshooting

---

## [2.4.2] — 2026-07-09

### Tài liệu (tái cấu trúc)
- **Xóa**: `TOOLS.md`, `docs/FEATURES.md`, `docs/agent-help.md`, `docs/agent-install.md` — ~3500 dòng nội dung chồng chéo và lỗi thời
- **Viết lại**: `README.md` — gọn ~180 dòng, cập nhật cho v2.4.x, link đến docs mới
- **Thêm**: `docs/actions.md` — reference đầy đủ 149 actions theo nhóm, có params và ví dụ
- **Sửa**: `CONTRIBUTING.md` — URL sai (`monasprox` → `monas-team`), rút gọn
- **Sửa**: Số lượng action: 147 → 149 (bao gồm `recall-group-history` và `list-passive-groups`)

---

## [2.4.1] — 2026-07-09

### Sửa lỗi (manifest)
- **openclaw.plugin.json**: Xóa `esUrl` khỏi `passiveCollector` config schema — ES không còn dùng từ v2.4.0
- **openclaw.plugin.json**: Cập nhật mô tả `passiveCollector` sang JSONL file storage
- **openclaw.plugin.json**: Thêm `activation.onStartup: true` theo yêu cầu docs OpenClaw
- **openclaw.plugin.json**: Thêm `compat` field
- **Install ledger**: Cập nhật version metadata lên 2.4.x

---

## [2.4.0] — 2026-07-09

### Thay đổi lớn (Breaking-free refactor)
- **passive-collector**: Loại bỏ hoàn toàn phụ thuộc Elasticsearch — giờ lưu vào file JSONL local
  - Storage: `~/.openclaw/workspace/zaloclaw/passive/{groupId}.jsonl`
  - Format: text-visible, một JSON record mỗi dòng — đọc được bằng bất kỳ text editor / CLI tool
  - Portable: hoạt động trên mọi OpenClaw install, không cần ES hay biến môi trường đặc biệt
- **tool**: Thêm 2 action mới cho `zaloclaw` tool:
  - `recall-group-history` — đọc lịch sử nhóm từ JSONL log (hỗ trợ `query`, `count`, `groupId`)
  - `list-passive-groups` — liệt kê tất cả nhóm đang được ghi passive log
- **monitor.ts**: `collectGroupMessage()` giờ là synchronous file append — không còn `await` + `.catch()`

### Sửa lỗi
- Xóa env var `OPENCLAW_ES_URL` / `ES_URL` không còn cần thiết
- Passive log không còn phụ thuộc epistemic plugin

## [2.3.0] — 2026-07-09

### Sửa lỗi
- **passive-collector**: `ES_URL` nay có thể cấu hình qua env var `OPENCLAW_ES_URL` hoặc `ES_URL` (fallback `http://localhost:19200`) — trước đây hardcoded
- **injection-guard**: `autoRemove` mặc định `false` — chỉ cảnh báo, không tự động xóa thành viên khỏi nhóm; cần bật rõ ràng qua config
- **monitor.ts**: Thêm null-guard cho `threadId`/`groupId` — tránh crash khi zca-js không gửi `groupId` trong một số loại sự kiện (recall, system events)
- **openclaw.plugin.json**: Thêm `passiveCollector` và `injectionGuard` vào `configSchema`

### Bảo mật
- **url-validator.ts**: Document rõ giới hạn TOCTOU của DNS rebinding validation
- **injection-guard.ts**: `autoRemove` mặc định `false` ngăn xóa thành viên ngoài ý muốn

### Tài liệu
- **README**: Thêm note quan trọng — sau khi cài plugin lần đầu, cần restart OpenClaw VÀ mở session chat mới (fixes issue #20)
- **README**: Cập nhật yêu cầu OpenClaw lên `>= 2026.5.7`
- **README**: Cập nhật version badge lên v2.3.0

### Yêu cầu
- OpenClaw >= 2026.5.7

---

## [2.1.2] — 2026-06-11

### Sửa lỗi
- **CRITICAL**: Thêm `openclaw.channel` vào `package.json` — thiếu field này khiến plugin bị bỏ qua hoàn toàn khỏi channel catalog, dẫn đến `channels login` luôn fail với "Unsupported channel" dù đã install đúng cách

## [2.1.1] — 2026-06-11

### Tài liệu
- **README**: Viết lại hoàn toàn hướng dẫn cài đặt — 3 cách (ClawHub / npm / clone) cả EN lẫn VI
- **Hướng dẫn QR**: Thêm bước quét QR (`Zalo app → trang cá nhân → icon QR`) và bước xác nhận sau login
- **VI**: Bổ sung Cách 2 (npm) còn thiếu, Cách 3 (clone) đúng thứ tự 4 bước
- **Troubleshooting**: Rõ hơn về `channels login` error và session expired

## [2.1.0] — 2026-06-11

### Cải thiện
- **README**: Thêm English section (bilingual EN+VI) — language toggle, quick-start, troubleshooting
- **Channels login**: Document lỗi `Unsupported channel` và workaround (`openclaw setup`) cho mọi phiên bản OpenClaw
- **Install flow**: Làm rõ `openclaw plugins install --link` là bắt buộc trước `channels login`; cập nhật cả cách 1 (ClawHub) và cách 2 (manual)
- **openclaw.plugin.json**: Thêm `name`, `description`, `version`, `kind`, `homepage` cho catalog discoverability
- **package.json**: Thêm `files`, `publishConfig`, `prepublishOnly` cho npm release; thêm keywords `openclaw-plugin`, `openclaw-channel`

## [2.0.4] — 2026-06-10

### Sửa lỗi
- **CI**: Fix `tsc` step exit code — dùng `continue-on-error` cho SDK version mismatch
- **README**: Redesign với centered header, ClawHub install, disclaimer, table of contents
- **Metadata**: Thêm ClawHub compat metadata, sửa repo URL sang `monas-team`

## [2.0.3] — 2026-04-15

### Sửa lỗi — API contract audit (18 bugs)

#### 🔴 Critical
- **`api.undo()`**: sửa gọi sai 2–3 params → đúng 1 param (`tool.ts`, `auto-unsend.ts`)
- **`addGroupBlockedMember` / `removeGroupBlockedMember`**: sửa thứ tự params ngược `(gid, uid)` → `(uid, gid)` (`tool.ts`)

#### 🔴 High
- **`updateProfile`**: thêm wrapper `{ profile: {...} }` bắt buộc + fetch profile hiện tại trước khi partial update (`tool.ts`)
- **`last-online`**: đổi từ `getUserInfo()` (luôn trả undefined) sang `api.lastOnline(uid)` đúng API (`tool.ts`)
- **`createProductCatalog`**: sửa 3 field names sai: `name`→`productName`, `desc`→`description`, `imageUrl`→`product_photos` (`tool.ts`)
- **`updateProductCatalog`**: sửa field names + thêm `catalogId`, `createTime` required fields (`tool.ts`)
- **`changeAccountAvatar`**: download URL → temp file trước khi gọi API (chỉ nhận local path/Buffer) (`tool.ts`)
- **`changeGroupAvatar`**: download URL → Buffer object trước khi gọi API (`tool.ts`)

#### 🟡 High
- **`forward-message`**: bỏ `msgId` field không tồn tại trong `ForwardMessagePayload`, document limitation (`tool.ts`)
- **DM `senderId` fallback**: thêm guard `rawSenderId.trim()` + warn log khi fallback xảy ra — chặn denyFrom bypass (`monitor.ts`)

#### 🟡 Medium
- **`undo-friend-request`**: bỏ fallback `removeFriend` nguy hiểm, chỉ dùng `undoFriendRequest` official API (`tool.ts`)
- **`getPollDetail`**: cast `pollId` sang string đúng docs: `String(p.pollId)` (`tool.ts`)
- **`getCurrentUid()` null safety**: fallback sang `api.getOwnId()` sync tại mention detection + listener startup (`monitor.ts`)
- **`getBizAccount`**: bỏ param `uid` (API không nhận params) (`tool.ts`)

#### 🟢 Low
- **`join-group-link`**: wrap `getGroupLinkInfo` trong try/catch riêng, không block `joinGroupLink` nếu throw (`tool.ts`)
- **`delete-chat`**: thêm comment document limitation empty `cliMsgId`/`globalMsgId` (`tool.ts`)
- **Tool description**: cập nhật "130 actions" → "147 actions" trong `index.ts`

## [2.0.2] — 2026-04-15

### Sửa lỗi
- **Media scoping**: sửa lỗi reply-scoped media binding — agent không còn lấy ảnh từ buffer chung của group (cross-message media contamination). Giờ chỉ resolve ảnh từ message hiện tại và reply target
- **CI**: tạo lại `package-lock.json` bằng npm 10 để fix `npm ci` failed (thiếu `opusscript@0.0.8`)

### Tái cấu trúc
- **Đổi tên dự án**: `opclaw-zalo` → `zaloclaw` trên toàn bộ codebase (package.json, imports, logs, configs, docs)

### Tài liệu
- Dịch toàn bộ tài liệu và templates sang tiếng Việt (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates)
- Thêm `docs/agent-help.md` — hướng dẫn toàn diện cho agent
- Thêm `TOOLS.md` — tham chiếu nhanh danh sách tools
- **`docs/agent-install.md`**: thêm Bước 0 kiểm tra plugin hiện có (bắt buộc xác nhận với owner trước khi gỡ), cấu trúc thư mục chuẩn, hướng dẫn migration từ plugin cũ, và debug guide 6 bước (status, logs, registration, config, credentials, lockfile)

## [2.0.1] — 2026-04-14

### Sửa lỗi
- **CI**: tạo lại `package-lock.json` bằng npm 10 để khắc phục lỗi `npm ci` (`opusscript@0.0.8` thiếu trong lock file)

### Bảo mật
- **Phòng chống SSRF**: wrapper `safeFetch` mới kiểm tra tất cả URL gửi đi — chặn IP nội bộ/riêng tư (IPv4 + IPv6), thông tin đăng nhập nhúng, scheme không phải HTTP, và DNS rebinding qua phân giải hostname
- **Phòng chống path traversal**: `enforceSandboxPath` áp dụng kiểm tra chứa lexical + xác minh symlink; tất cả thao tác thread giới hạn trong `~/.openclaw/workspace/threads/`
- **Whitelist truy cập file local**: `validateLocalFilePath` giới hạn thao tác file trong `~/.openclaw/workspace/`, `~/.openclaw/media/`, và thư mục temp hệ thống
- **Bảo mật credentials**: thông tin đăng nhập lưu trữ được ghi với quyền `0600`; thư mục tạo với quyền `0700`
- **Lọc đầu ra**: giảm độ dài tối thiểu secret từ 20 → 8 ký tự; regex patterns tạo mới mỗi lần gọi để tránh race condition `lastIndex`
- **Sửa race condition**: `getApi()` sử dụng promise memoization để tránh đăng nhập trùng lặp đồng thời
- **An toàn tải ảnh**: tên file dạng hash, phần mở rộng whitelist, giới hạn 20 MB, xác minh chứa path
- **Cô lập QR code**: file temp duy nhất mỗi lần gọi (`crypto.randomBytes`) với quyền `0600`
- **Sanitize Thread ID**: chỉ ASCII chữ-số/gạch ngang/gạch dưới, tối đa 100 ký tự

### Thay đổi
- **TypeScript strict mode** bật (`tsconfig.json`)
- **Xác thực tham số tool**: tất cả đường dẫn file local và URL gửi đi được kiểm tra qua các module safety

### Thêm mới
- `src/safety/url-validator.ts` — fetch an toàn SSRF với kiểm tra IP, phân giải DNS, timeout, và giới hạn kích thước
- `src/types/vendor.d.ts` — khai báo kiểu cho `qrcode-terminal`, `jsqr`, và `pngjs`
- Framework test (vitest) với 63 test bảo mật và regression trên 5 file test
- `validateLocalFilePath`, `enforceSandboxPath`, `cleanupOldSandboxes` trong thread-sandbox
- `isPrivateIp`, `validateUrlForOutboundFetch`, `safeFetch` trong url-validator

### Sửa lỗi
- `isLocalFilePath` trong `send.ts` không còn khớp URL chứa chuỗi con giống path — giờ chỉ khớp đường dẫn hệ thống file thực

## [2.2.0] — 2026-07-08

### Tương thích
- **Fix import paths cho OpenClaw 2026.5.7**: `openclaw/plugin-sdk/zalouser` không còn export `OpenClawConfig`, `MarkdownTableMode`, `RuntimeEnv` — di chuyển sang `plugin-sdk/config-runtime` và `plugin-sdk/runtime`
- **Thêm `contracts.tools`** vào `openclaw.plugin.json` — bắt buộc để expose `zaloclaw` tool ra agent sessions (OpenClaw ≥2026.5)

### Sửa lỗi
- **Group reply via outbound**: `outbound.sendText/sendMedia` luôn dùng `ThreadType.User` — tin nhắn vào group ID bị gửi nhầm DM. Fix: thêm `group-id-cache.ts` — khi nhận message từ group thì cache group ID, outbound tự detect `isGroup`
- **Typing keepalive**: thêm `setInterval` 3s ngay sau khi nhận message để cover khoảng thời gian model setup (gap giữa first typing event và typing keepalive)
- **Reaction fallback**: thêm `lookupCliMsgId()` fallback khi `message.cliMsgId` vắng mặt trong DM events
- **`ackReactionScope`**: đổi default thành `all` để reaction fire cả DM lẫn group

### Đã xác minh
- TypeScript typecheck: **pass** (0 errors)
- Test suite: **104/104 passed**
- Tương thích: OpenClaw 2026.5.7, Node.js 22+, zca-js 2.1.2

---

## [2.0.0] — 2026-04-14

### Thay đổi
- **Tái cấu trúc dự án**: sắp xếp lại `src/` thành các module theo domain (`channel/`, `client/`, `config/`, `tools/`, `parsing/`, `safety/`, `runtime/`, `features/`)
- **Báo cáo trạng thái**: `collectStatusIssues` giờ đồng bộ — sửa crash trong `openclaw status` khi core spread giá trị async
- **Xử lý hình ảnh**: ảnh trong nhóm chỉ được xử lý khi bot được @mention; ảnh không mention được đệm cho ngữ cảnh sau

### Sửa lỗi
- `collectStatusIssues` trả về `Promise` (async) nhưng core mong đợi sync `StatusIssue[]` — gây `TypeError: Spread syntax requires ...iterable[Symbol.iterator]`
- Tin nhắn chỉ có ảnh trong nhóm bypass mention gate qua kiểm tra `!hasMedia` — bot phản hồi mọi ảnh bất kể @mention
- Quét trạng thái báo "chưa đăng nhập" ngay cả khi bot đang hoạt động — `collectStatusIssues` chạy trong tiến trình CLI nơi `apiInstance` luôn null; giờ kiểm tra credentials trên đĩa thay thế

### Thêm mới
- `README.md` với tài liệu đầy đủ
- `LICENSE` (MIT)
- `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- `.editorconfig`, `.github/` templates và CI workflow
- `.gitignore` toàn diện

## [1.0.0] — 2026-04-13

### Thêm mới
- Phát hành đầu tiên với tên `zaloclaw` (đổi tên từ `zalo-personal`)
- Tích hợp đầy đủ tài khoản Zalo cá nhân qua zca-js v2.1.2
- 130+ agent tool actions (nhắn tin, bạn bè, nhóm, bình chọn, nhắc nhở, hồ sơ, danh mục sản phẩm, v.v.)
- Luồng đăng nhập QR code với lưu trữ credentials tự động
- Mention gating nhóm với cấu hình theo nhóm
- Chính sách truy cập DM: open, pairing, allowlist, disabled
- Tính năng: reaction-ack, quote-reply, read-receipts, hỗ trợ sticker, auto-unsend, message buffering
