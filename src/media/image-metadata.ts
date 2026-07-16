import { readFile } from "node:fs/promises";
import { imageSize } from "image-size";

export async function readImageMetadata(filePath: string): Promise<{
  width: number;
  height: number;
  size: number;
}> {
  const data = await readFile(filePath);
  const dimensions = imageSize(data);
  return {
    width: dimensions.width || 0,
    height: dimensions.height || 0,
    size: data.length,
  };
}
