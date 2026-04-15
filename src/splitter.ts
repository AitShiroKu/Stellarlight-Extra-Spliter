import { mkdir, copyFile } from "fs/promises";
import { resolve, join } from "path";
import type { ClassifiedMod, ModCategory, ProgressCallback } from "./types";

const CATEGORY_FOLDERS: Record<ModCategory, string> = {
  "client-side": "client-side",
  "server-side": "server-side",
  "library": "library",
  "gameplay": "gameplay",
  "unknown": "unknown",
};

/**
 * Copy classified mods to their respective output subfolders.
 * Creates folders: client-side/, server-side/, library/, gameplay/, unknown/
 */
export async function splitMods(
  mods: ClassifiedMod[],
  outputDir: string,
  concurrency: number = 10,
  onProgress?: ProgressCallback
): Promise<void> {
  const absoluteOutput = resolve(outputDir);

  // Create all category directories
  for (const folder of Object.values(CATEGORY_FOLDERS)) {
    await mkdir(join(absoluteOutput, folder), { recursive: true });
  }

  const total = mods.length;

  for (let i = 0; i < total; i += concurrency) {
    const batch = mods.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (mod) => {
        const destFolder = CATEGORY_FOLDERS[mod.category];
        const destPath = join(absoluteOutput, destFolder, mod.file.filename);
        await copyFile(mod.file.filepath, destPath);
      })
    );

    const done = Math.min(i + concurrency, total);
    onProgress?.({
      stage: "copying",
      message: `Copying files... ${done}/${total}`,
      current: done,
      total,
      percentage: Math.round((done / total) * 100),
    });
  }
}
