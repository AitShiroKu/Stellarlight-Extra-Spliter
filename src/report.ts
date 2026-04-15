import { resolve, join } from "path";
import type {
  ClassifiedMod,
  ModCategory,
  SplitReport,
  ModFile,
} from "./types";
import { formatSize } from "./scanner";

const ALL_CATEGORIES: ModCategory[] = [
  "client-side",
  "server-side",
  "library",
  "gameplay",
  "unknown",
];

/**
 * Generate a structured report from classification results.
 */
export function generateReport(
  mods: ClassifiedMod[],
  inputPath: string,
  outputPath: string,
  startTime: number
): SplitReport {
  const summary: Record<ModCategory, number> = {
    "client-side": 0,
    "server-side": 0,
    library: 0,
    gameplay: 0,
    unknown: 0,
  };

  const allLoaders = new Set<string>();
  const allGameVersions = new Set<string>();
  const unknownMods: ModFile[] = [];

  for (const mod of mods) {
    summary[mod.category]++;
    mod.loaders.forEach((l) => allLoaders.add(l));
    mod.gameVersions.forEach((v) => allGameVersions.add(v));
    if (mod.category === "unknown") {
      unknownMods.push(mod.file);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    inputPath: resolve(inputPath),
    outputPath: resolve(outputPath),
    totalMods: mods.length,
    summary,
    detectedLoaders: [...allLoaders].sort(),
    detectedGameVersions: [...allGameVersions].sort(),
    mods,
    unknownMods,
    duration: Date.now() - startTime,
  };
}

/**
 * Save report as JSON file.
 */
export async function saveJsonReport(
  report: SplitReport,
  outputPath: string
): Promise<string> {
  const filePath = join(resolve(outputPath), "report.json");
  // Create a clean version without circular refs
  const cleanReport = {
    ...report,
    mods: report.mods.map((m) => ({
      filename: m.file.filename,
      size: m.file.size,
      sizeFormatted: formatSize(m.file.size),
      sha512: m.file.sha512,
      category: m.category,
      projectTitle: m.project?.title ?? null,
      projectSlug: m.project?.slug ?? null,
      modrinthUrl: m.modrinthUrl ?? null,
      clientSide: m.project?.client_side ?? null,
      serverSide: m.project?.server_side ?? null,
      categories: m.project?.categories ?? [],
      loaders: m.loaders,
      gameVersions: m.gameVersions,
    })),
  };

  await Bun.write(filePath, JSON.stringify(cleanReport, null, 2));
  return filePath;
}

/**
 * Save report as Markdown file.
 */
export async function saveMarkdownReport(
  report: SplitReport,
  outputPath: string
): Promise<string> {
  const filePath = join(resolve(outputPath), "report.md");
  const lines: string[] = [];

  lines.push("✨ Stellalright Extra Splitter Report📄")
  lines.push("");
  lines.push(`📅 **Generated:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`⏱️ **Duration:** ${(report.duration / 1000).toFixed(1)}s`);
  lines.push(`📁 **Input:** \`${report.inputPath}\``);
  lines.push(`📂 **Output:** \`${report.outputPath}\``);
  lines.push(`📦 **Total Mods:** ${report.totalMods}`);
  lines.push("");

  // Summary
  lines.push("## 📊 Summary");
  lines.push("");
  lines.push("| Category | Count | Percentage |");
  lines.push("|----------|------:|------------|");
  for (const cat of ALL_CATEGORIES) {
    const count = report.summary[cat];
    const pct = report.totalMods > 0
      ? ((count / report.totalMods) * 100).toFixed(1)
      : "0.0";
    const emoji = {
      "client-side": "🖥️",
      "server-side": "🖧",
      library: "📚",
      gameplay: "🎮",
      unknown: "❓",
    }[cat];
    lines.push(`| ${emoji} ${cat} | ${count} | ${pct}% |`);
  }
  lines.push("");

  // Detected info
  if (report.detectedLoaders.length > 0) {
    lines.push(
      `**Detected Loaders:** ${report.detectedLoaders.map((l) => `\`${l}\``).join(", ")}`
    );
  }
  if (report.detectedGameVersions.length > 0) {
    const versions = report.detectedGameVersions.slice(0, 10);
    lines.push(
      `**Detected Game Versions:** ${versions.map((v) => `\`${v}\``).join(", ")}${report.detectedGameVersions.length > 10 ? ` ... (+${report.detectedGameVersions.length - 10} more)` : ""}`
    );
  }
  lines.push("");

  // Mod tables per category
  for (const cat of ALL_CATEGORIES) {
    const categoryMods = report.mods.filter((m) => m.category === cat);
    if (categoryMods.length === 0) continue;

    const emoji = {
      "client-side": "🖥️",
      "server-side": "🖧",
      library: "📚",
      gameplay: "🎮",
      unknown: "❓",
    }[cat];

    lines.push(`## ${emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${categoryMods.length})`);
    lines.push("");
    lines.push("| # | Mod Name | File | Size | Loaders |");
    lines.push("|--:|----------|------|-----:|---------|");

    categoryMods.forEach((mod, idx) => {
      const name = mod.project
        ? `[${mod.project.title}](${mod.modrinthUrl})`
        : mod.file.filename.replace(".jar", "");
      const loaders = mod.loaders.join(", ") || "—";
      lines.push(
        `| ${idx + 1} | ${name} | \`${mod.file.filename}\` | ${formatSize(mod.file.size)} | ${loaders} |`
      );
    });
    lines.push("");
  }

  // Unknown mods
  if (report.unknownMods.length > 0) {
    lines.push("## ⚠️ Mods Not Found on Modrinth");
    lines.push("");
    lines.push("These mods could not be identified via the Modrinth API.");
    lines.push("They may be from CurseForge, custom builds, or private mods.");
    lines.push("");
    for (const mod of report.unknownMods) {
      lines.push(`- \`${mod.filename}\` (${formatSize(mod.size)})`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by [Minecraft Mod Splitter](https://github.com/zakura)*");

  await Bun.write(filePath, lines.join("\n"));
  return filePath;
}
