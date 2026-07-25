/**
 * Generic file downloader for non-image attachments (CSV, PDF, DOCX, etc.).
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

/** Max file download size: 50 MB (higher than images to accommodate PDFs, spreadsheets) */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Download a generic file from a URL, saving it to the inbound media directory.
 * Unlike image-downloader, this accepts any file type (no MIME/extension whitelist).
 *
 * Returns the local file path on success, undefined on failure.
 */
export async function downloadFileFromUrl(
  url: string,
  workspaceDir?: string,
): Promise<string | undefined> {
  try {
    // See image-downloader: use OPENCLAW_HOME so the container's HOME=.openclaw
    // doesn't double the ".openclaw" segment and escape the allowed media dir.
    const openclawHome = process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
    const targetDir = workspaceDir || path.join(openclawHome, "media", "inbound");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Use safeFetch with SSRF protection and size limits
    const isZaloCdn = /^https:\/\/(?:[a-z0-9-]+\.)*(?:zalo|zadn|zdn)\.(?:vn|me)\//i.test(url);
    const { buffer, contentType } = await safeFetch(url, {
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
      skipSsrfCheck: isZaloCdn,
    });

    // Log content type for debugging (no rejection — accept any type)
    if (contentType) {
      console.log(`[file-downloader] Downloaded ${contentType} from ${url}`);
    }

    // Generate safe filename from hash — never use URL path components directly.
    // Zalo file CDN links often carry no extension in the path, so fall back to
    // the response content-type; otherwise the model can't tell it's a PDF/DOCX.
    const urlHash = crypto.createHash("sha256").update(url).digest("hex").substring(0, 12);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const ext = getSafeExtension(url) || extensionFromContentType(contentType) || "file";
    const filename = `${timestamp}-zalo-file-${urlHash}.${ext}`;
    const filePath = path.join(targetDir, filename);

    // Verify the final path is within the target directory (defense-in-depth)
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(targetDir);
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      console.error(`[file-downloader] Path traversal blocked: ${filePath}`);
      return undefined;
    }

    fs.writeFileSync(filePath, buffer);
    console.log(`[file-downloader] Saved to ${filePath} (${buffer.length} bytes)`);
    return filePath;
  } catch (err) {
    console.error(`[file-downloader] Error downloading ${url}:`, err);
    return undefined;
  }
}

export async function downloadFilesFromUrls(
  urls: string[],
  workspaceDir?: string,
): Promise<(string | undefined)[]> {
  return Promise.all(urls.map(url => downloadFileFromUrl(url, workspaceDir)));
}

/**
 * Extract a file extension from a URL.
 * Returns the extension if found, empty string if not.
 * Unlike image-downloader, does NOT whitelist — just extracts.
 */
function getSafeExtension(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-z0-9]{1,6})$/i);
    if (match) {
      return match[1].toLowerCase();
    }
  } catch {
    // invalid URL
  }
  return "";
}

/** Map a response content-type to a file extension (best-effort, safe fallback). */
function extensionFromContentType(contentType?: string | null): string {
  if (!contentType) return "";
  const t = contentType.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/csv": "csv",
    "text/plain": "txt",
    "text/markdown": "md",
    "application/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
    "application/vnd.rar": "rar",
    "application/gzip": "gz",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
  };
  return map[t] || "";
}
