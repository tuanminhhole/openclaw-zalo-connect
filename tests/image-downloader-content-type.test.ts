/**
 * Zalo's photo CDN routinely serves real photos as `application/octet-stream`.
 *
 * Verified against the live CDN while debugging a production host: a URL ending in `.jpg` answered
 * `200 application/octet-stream`, 23704 bytes, and the body was a valid baseline JPEG
 * (`ff d8 ff db`, 512x512). The header-only gate threw those away — 6 of 7 inbound images on that
 * host — and because the same URL fails on every retry it looked like "images from that person never
 * work" rather than "the Content-Type is unreliable".
 *
 * So: a generic binary type must defer to the magic bytes, while types that are positively wrong
 * (HTML error pages and friends) must still be refused, and a generic type with unrecognisable bytes
 * must not become a way in for junk.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const fetchMock = vi.hoisted(() => ({ impl: vi.fn() }));

vi.mock("../src/safety/url-validator.js", () => ({
  safeFetch: (...args: unknown[]) => fetchMock.impl(...args),
}));

const { downloadImageFromUrl } = await import("../src/channel/image-downloader.js");

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(64, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64, 7)]);
const HTML = Buffer.from("<!DOCTYPE html><html><head><title>404</title></head></html>", "utf8");
const JUNK = Buffer.concat([Buffer.from([0x00, 0x01, 0x02, 0x03]), Buffer.alloc(64, 9)]);

const URL_JPG = "https://photo-stal-7.zdn.vn/no/b46c1316ca910dcf5480/2HGb6F1Dm.jpg";

let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "zc-img-"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  fetchMock.impl.mockReset();
});

function serve(buffer: Buffer, contentType?: string) {
  fetchMock.impl.mockResolvedValue({ buffer, contentType });
}

describe("image-downloader content-type handling", () => {
  it("accepts a real JPEG served as application/octet-stream (the Zalo CDN case)", async () => {
    serve(JPEG, "application/octet-stream");
    const saved = await downloadImageFromUrl(URL_JPG, dir);
    expect(saved).toBeTruthy();
    expect(fs.existsSync(saved!)).toBe(true);
    expect(fs.readFileSync(saved!).subarray(0, 4)).toEqual(JPEG.subarray(0, 4));
  });

  it("accepts a PNG served with no content-type at all", async () => {
    serve(PNG, undefined);
    await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeTruthy();
  });

  it("still accepts a correctly declared image", async () => {
    serve(JPEG, "image/jpeg; charset=binary");
    await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeTruthy();
  });

  it("still refuses an HTML error page declared as text/html", async () => {
    serve(HTML, "text/html; charset=utf-8");
    await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeUndefined();
  });

  it("still refuses an HTML error page smuggled under octet-stream", async () => {
    serve(HTML, "application/octet-stream");
    await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeUndefined();
  });

  it("refuses unidentifiable bytes under a generic type — relaxing the header is not a way in", async () => {
    serve(JUNK, "application/octet-stream");
    await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeUndefined();
  });

  it("keeps refusing types that are positively wrong", async () => {
    for (const mime of ["application/json", "video/mp4", "text/plain", "application/pdf"]) {
      serve(JPEG, mime);
      await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeUndefined();
    }
  });

  it("keeps the lenient path for a declared image whose format we do not recognise", async () => {
    serve(JUNK, "image/heif");
    await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeTruthy();
  });
});

/**
 * HEIC/AVIF share the ISO-BMFF container with MP4: box length, then `ftyp`, then a 4-char brand.
 * Only the brand tells a photo from a video, so the brand is the whole test — an `ftyp`-means-image
 * shortcut would feed every MP4 into the image pipeline.
 */
function isoBmff(brand: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),  // box size
    Buffer.from("ftyp", "latin1"),
    Buffer.from(brand, "latin1"),
    Buffer.alloc(64, 0),
  ]);
}

describe("ISO-BMFF image brands (iPhone HEIC / AVIF)", () => {
  // Zalo names every photo URL ".jpg", so the extension must come from the bytes, not the URL.
  it.each(["heic", "heix", "mif1", "msf1"])("accepts HEIC brand %s and saves it as .heic", async (brand) => {
    serve(isoBmff(brand), "application/octet-stream");
    const saved = await downloadImageFromUrl(URL_JPG, dir);
    expect(saved).toBeTruthy();
    expect(saved!.endsWith(".heic")).toBe(true);
  });

  it.each(["avif", "avis"])("accepts AVIF brand %s and saves it as .avif", async (brand) => {
    serve(isoBmff(brand), "application/octet-stream");
    const saved = await downloadImageFromUrl(URL_JPG, dir);
    expect(saved).toBeTruthy();
    expect(saved!.endsWith(".avif")).toBe(true);
  });

  it.each(["isom", "mp42", "qt  ", "M4V "])("refuses video brand %s — ftyp alone is not an image", async (brand) => {
    serve(isoBmff(brand), "application/octet-stream");
    await expect(downloadImageFromUrl(URL_JPG, dir)).resolves.toBeUndefined();
  });

  it("names a real JPEG .jpg even when the URL claims something else", async () => {
    serve(JPEG, "application/octet-stream");
    const saved = await downloadImageFromUrl("https://photo-stal-7.zdn.vn/no/x/y.png", dir);
    expect(saved!.endsWith(".jpg")).toBe(true);
  });
});
