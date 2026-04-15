import { type ModFile, type ProgressCallback } from "./types";
import { resolve } from "path";
import { readdir, stat } from "fs/promises";

/**
 * Scan a directory for .jar mod files and compute SHA-512 hashes.
 * Uses parallel hashing in batches for performance.
 */
export async function scanMods(
  inputDir: string,
  concurrency: number = 20,
  onProgress?: ProgressCallback
): Promise<ModFile[]> {
  const absoluteDir = resolve(inputDir);

  // Check if directory exists
  try {
    const dirStat = await stat(absoluteDir);
    if (!dirStat.isDirectory()) {
      throw new Error(`"${absoluteDir}" is not a directory`);
    }
  } catch (err: any) {
    if (err.code === "ENOENT") {
      throw new Error(`Directory not found: "${absoluteDir}"`);
    }
    throw err;
  }

  // Find all .jar files
  onProgress?.({
    stage: "scanning",
    message: "Scanning for .jar files...",
    current: 0,
    total: 0,
    percentage: 0,
  });

  const entries = await readdir(absoluteDir);
  const jarFiles = entries.filter((f) => f.toLowerCase().endsWith(".jar"));

  if (jarFiles.length === 0) {
    throw new Error(`No .jar files found in "${absoluteDir}"`);
  }

  onProgress?.({
    stage: "scanning",
    message: `Found ${jarFiles.length} .jar files`,
    current: jarFiles.length,
    total: jarFiles.length,
    percentage: 100,
  });

  // Hash files in parallel batches
  const modFiles: ModFile[] = [];
  const total = jarFiles.length;

  for (let i = 0; i < total; i += concurrency) {
    const batch = jarFiles.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (filename) => {
        const filepath = `${absoluteDir}/${filename}`;
        const file = Bun.file(filepath);
        const buffer = await file.arrayBuffer();
        const hasher = new Bun.CryptoHasher("sha512");
        hasher.update(buffer);
        const sha512 = hasher.digest("hex");

        return {
          filename,
          filepath,
          size: file.size,
          sha512,
        } satisfies ModFile;
      })
    );

    modFiles.push(...results);

    onProgress?.({
      stage: "hashing",
      message: `Hashing files... ${Math.min(i + concurrency, total)}/${total}`,
      current: Math.min(i + concurrency, total),
      total,
      percentage: Math.round((Math.min(i + concurrency, total) / total) * 100),
    });
  }

  return modFiles;
}

/**
 * Format file size in human-readable format
 */
export function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
