# Đóng góp cho OpenClaw Zalo Connect

## Thiết lập

```bash
git clone https://github.com/tuanminhhole/openclaw-zalo-connect.git
cd openclaw-zalo-connect
npm install
```

## Quy trình phát triển

```bash
npm run typecheck      # Kiểm tra TypeScript
npm run test           # Chạy Vitest
npm run build          # Build dist/index.js

# Link vào OpenClaw để test trực tiếp
openclaw plugins install --link .
openclaw gateway restart
```

## Thêm action mới

1. Thêm tên action vào mảng `as const` trong `src/tools/tool.ts`
2. Thêm handler trong `switch` statement cùng file
3. Cập nhật `docs/actions.md`
4. Chạy `npm run typecheck && npm run build`

## Báo lỗi / đề xuất tính năng

Mở issue tại: https://github.com/tuanminhhole/openclaw-zalo-connect/issues

Đối với lỗ hổng bảo mật — xem [SECURITY.md](SECURITY.md).
