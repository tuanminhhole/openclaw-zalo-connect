/**
 * Image downloader with security hardening.
 *
 * [C1] Path traversal prevention — filename is hash-based, never user-controlled
 * [M4] Download size limits — stream-based with max size enforcement
 * [C4] SSRF protection — uses safeFetch for URL validation
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import { safeFetch } from "../safety/url-validator.js";

/** Max image download size: 20 MB */
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

/** Allowed image extensions (deny-by-default) */
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "heic", "avif"]);

/** Extension to save under, keyed by what detectImageType() reported. */
const EXTENSION_FOR_TYPE: Record<string, string> = {
  jpeg: "jpg", png: "png", gif: "gif", webp: "webp", bmp: "bmp", svg: "svg", heic: "heic", avif: "avif",
};

/** Allowed MIME types for images */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/tiff",
]);

/**
 * Content types that say "some bytes" and nothing more.
 *
 * Zalo's photo CDN serves plenty of real photos this way — verified against the live CDN: a URL
 * ending in `.jpg` answered `200 application/octet-stream`, 23704 bytes, and the body was a valid
 * baseline JPEG (`ff d8 ff db`, 512x512). On one production host 6 of 7 inbound images were thrown
 * away for this reason, and the same URL failed on every retry, which is why it looked like "images
 * from that person never work" instead of "the header is unreliable".
 *
 * A generic binary type is therefore not evidence of anything and must not be a verdict. The
 * magic-byte check further down is both stricter and actually correct — it is what catches the CDN's
 * HTML error pages — so these types defer to it rather than rejecting outright.
 */
const GENERIC_BINARY_MIME_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/binary",
  "application/download",
]);

/** Magic bytes signatures for common image formats */
const IMAGE_MAGIC_BYTES: { prefix: number[]; type: string }[] = [
  { prefix: [0xFF, 0xD8, 0xFF], type: "jpeg" },           // JPEG
  { prefix: [0x89, 0x50, 0x4E, 0x47], type: "png" },      // PNG
  { prefix: [0x47, 0x49, 0x46, 0x38], type: "gif" },      // GIF (GIF87a/GIF89a)
  { prefix: [0x52, 0x49, 0x46, 0x46], type: "webp" },     // WebP (RIFF container)
  { prefix: [0x42, 0x4D], type: "bmp" },                  // BMP
];

/**
 * ISO-BMFF brands that mean "this is a still image", for HEIC/AVIF detection.
 *
 * HEIC and AVIF share their container with MP4 — every one of them starts with a box length, then
 * the literal `ftyp`, then a 4-char brand. Only the brand separates a photo from a video, so match on
 * the brand and nothing else: treating any `ftyp` file as an image would hand every MP4 to the image
 * pipeline. `mif1`/`msf1` are the generic HEIF image/sequence brands iPhones also emit.
 */
const ISO_BMFF_IMAGE_BRANDS: Record<string, string> = {
  heic: "heic", heix: "heic", hevc: "heic", hevx: "heic",
  heim: "heic", heis: "heic", hevm: "heic", hevs: "heic",
  mif1: "heic", msf1: "heic",
  avif: "avif", avis: "avif",
};

/**
 * Check if buffer starts with valid image magic bytes.
 * Returns the detected type or undefined if not recognized.
 */
function detectImageType(buffer: Buffer): string | undefined {
  for (const { prefix, type } of IMAGE_MAGIC_BYTES) {
    if (buffer.length >= prefix.length) {
      const match = prefix.every((byte, i) => buffer[i] === byte);
      if (match) return type;
    }
  }
  // HEIC/AVIF: "ftyp" sits at offset 4, the brand at offset 8 — not a prefix, so it cannot go in
  // IMAGE_MAGIC_BYTES above. Modern iPhones send these, and Zalo's CDN serves them as
  // application/octet-stream like everything else, so without this they are dropped as "unidentified".
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("latin1").toLowerCase();
    const imageType = ISO_BMFF_IMAGE_BRANDS[brand];
    if (imageType) return imageType;
  }
  // SVG detection: starts with "<svg" or "<?xml"
  const head = buffer.subarray(0, 100).toString("utf8").trim().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) {
    return "svg";
  }
  return undefined;
}

export async function downloadImageFromUrl(
  url: string,
  workspaceDir?: string,
): Promise<string | undefined> {
  try {
    // Resolve the OpenClaw home from OPENCLAW_HOME (the container sets HOME to the
    // .openclaw dir itself, so os.homedir() already ends in .openclaw — joining
    // ".openclaw/media" onto it would double the segment and land outside the
    // media dir the core `image` tool allows). Fall back to ~/.openclaw for CLI/dev.
    const openclawHome = process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
    const targetDir = workspaceDir || path.join(openclawHome, "media", "inbound");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Generate safe filename from hash — never use URL path components directly
    const urlHash = crypto.createHash("sha256").update(url).digest("hex").substring(0, 12);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const resolvedDir = path.resolve(targetDir);
    /** Build the destination for an extension, refusing anything that escapes targetDir. */
    const destFor = (ext: string): string | undefined => {
      const candidate = path.join(targetDir, `${timestamp}-zalo-${urlHash}.${ext}`);
      if (!path.resolve(candidate).startsWith(resolvedDir + path.sep)) {
        console.error(`[image-downloader] Path traversal blocked: ${candidate}`);
        return undefined;
      }
      return candidate;
    };
    if (!destFor(getSafeExtension(url))) return undefined;

    // Use safeFetch with SSRF protection and size limits
    // Skip SSRF check for Zalo CDN URLs (they are from the Zalo API itself)
    // Strict hostname matching: must end with .zalo.vn, .zadn.vn, .zdn.vn, etc.
    const isZaloCdn = /^https:\/\/(?:[a-z0-9-]+\.)*(?:zalo|zadn|zdn)\.(?:vn|me)\//i.test(url);
    const { buffer, contentType } = await safeFetch(url, {
      maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
      skipSsrfCheck: isZaloCdn,
    });

    // [FIX] Reject content types that are positively wrong (text/html error pages, json, video…).
    // A missing or generic-binary type is not wrong, just uninformative: it defers to the magic-byte
    // check below, which decides on the actual bytes. See GENERIC_BINARY_MIME_TYPES for why.
    const mimeBase = contentType?.split(";")[0]?.trim().toLowerCase();
    const declaredImage = !!mimeBase && (ALLOWED_MIME_TYPES.has(mimeBase) || mimeBase.startsWith("image/"));
    const declaredNothing = !mimeBase || GENERIC_BINARY_MIME_TYPES.has(mimeBase);
    if (!declaredImage && !declaredNothing) {
      console.warn(`[image-downloader] Rejected non-image content-type "${contentType}" from ${url}`);
      return undefined;
    }

    // [FIX] Validate magic bytes to ensure it's actually an image (not HTML/text)
    const detectedType = detectImageType(buffer);
    if (!detectedType) {
      // Check if it looks like HTML (common when CDN returns error pages)
      const headStr = buffer.subarray(0, 200).toString("utf8").toLowerCase();
      if (headStr.includes("<!doctype") || headStr.includes("<html") || headStr.includes("<head")) {
        console.warn(`[image-downloader] Rejected HTML content disguised as image from ${url}`);
        return undefined;
      }
      if (declaredNothing) {
        // Nothing declared this an image and nothing in the bytes says so either — with no evidence
        // at all, refuse. This keeps the relaxed header check from becoming a way in for junk.
        console.warn(`[image-downloader] Rejected unidentified binary (content-type "${contentType ?? "none"}") from ${url}`);
        return undefined;
      }
      // Server declared an image but we don't recognise the format — allow with warning
      console.warn(`[image-downloader] Unknown image format from ${url}, saving anyway`);
    }

    // Name the file after what the BYTES are, falling back to the URL's extension. Zalo rewrites
    // every photo URL to end in `.jpg`, so a HEIC from an iPhone would otherwise be saved as `.jpg`
    // and mislead whatever opens it next.
    const ext = detectedType ? EXTENSION_FOR_TYPE[detectedType] ?? getSafeExtension(url) : getSafeExtension(url);
    const filePath = destFor(ext);
    if (!filePath) return undefined;

    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    console.error(`[image-downloader] Error downloading ${url}:`, err);
    return undefined;
  }
}

export async function downloadImagesFromUrls(
  urls: string[],
  workspaceDir?: string,
): Promise<(string | undefined)[]> {
  return Promise.all(urls.map(url => downloadImageFromUrl(url, workspaceDir)));
}

/**
 * Extract a safe file extension from a URL.
 * Only returns whitelisted image extensions; defaults to "jpg".
 */
function getSafeExtension(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    if (match) {
      const ext = match[1].toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext)) return ext;
    }
  } catch {
    // invalid URL
  }
  return "jpg";
}
