import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { _buildAttachmentPathNote as buildAttachmentPathNote } from "../src/channel/monitor.js";

// Bối cảnh (01/09/2026, mac_dr-tuan): owner gửi skill .zip qua DM, runtime tải file thành công và
// đặt MediaPath tuyệt đối vào ctx, model còn `read media://inbound/…` ra đúng byte ZIP — nhưng sau
// đó lại `find .` trong WORKSPACE, không thấy, rồi báo owner là file "chưa được lưu". Model yếu
// (smart-route) không nối trường MediaPath có cấu trúc vào lệnh exec. Vá ở tầng kênh: ghi thẳng
// đường dẫn tuyệt đối vào thân lượt chat — chỗ mọi model bắt buộc phải đọc.

describe("buildAttachmentPathNote", () => {
    it("file non-image phải được ghi chú kèm đường dẫn tuyệt đối", () => {
        const note = buildAttachmentPathNote(["/home/node/project/.openclaw/media/inbound/bstuan-banner-xanh_8.zip"]);
        expect(note).toContain("/home/node/project/.openclaw/media/inbound/bstuan-banner-xanh_8.zip");
        expect(note).toMatch(/exec\/read/);
        expect(note).toMatch(/NOT inside your workspace/);
    });

    it("ảnh KHÔNG được ghi chú — ảnh attach native, note mỗi tấm chỉ làm nhiễu prompt", () => {
        expect(buildAttachmentPathNote(["/tmp/a.jpg", "/tmp/b.PNG", "/tmp/c.webp"])).toBe("");
    });

    it("trộn ảnh + file thì chỉ ghi phần file", () => {
        const note = buildAttachmentPathNote(["/tmp/photo.jpeg", "/tmp/bao-gia.pdf", "/tmp/skill.zip"]);
        expect(note).toContain("/tmp/bao-gia.pdf");
        expect(note).toContain("/tmp/skill.zip");
        expect(note).not.toContain("photo.jpeg");
    });

    it("không có đính kèm thì trả chuỗi rỗng, không đụng body", () => {
        expect(buildAttachmentPathNote(undefined)).toBe("");
        expect(buildAttachmentPathNote([])).toBe("");
    });

    it("note phải được CỘNG vào bodyWithSender trước khi dựng envelope/BodyForAgent", () => {
        // Chốt vị trí gắn note trong monitor.ts: sau khi chốt effectiveLocalMediaPaths,
        // trước formatAgentEnvelope — lệch chỗ là note không tới được prompt của model.
        const src = readFileSync(new URL("../src/channel/monitor.ts", import.meta.url), "utf8");
        expect(src).toMatch(
            /const effectiveLocalMediaPaths = [^;]+;\s*\n\s*bodyWithSender \+= buildAttachmentPathNote\(effectiveLocalMediaPaths\);\s*\n\s*const body = core\.channel\.reply\.formatAgentEnvelope\(/,
        );
    });
});
