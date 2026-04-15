#!/usr/bin/env bun
import { parseArgs } from "util";
import { scanMods } from "./scanner";
import { ModrinthClient } from "./modrinth";
import { classifyAll } from "./classifier";
import { splitMods } from "./splitter";
import {
  generateReport,
  saveJsonReport,
  saveMarkdownReport,
} from "./report";
import type { SplitOptions, ProgressCallback, ModCategory } from "./types";
import { CATEGORY_LABELS } from "./types";

// ===== ANSI Colors =====
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
};

const CATEGORY_CLI_COLORS: Record<ModCategory, string> = {
  "client-side": c.blue,
  "server-side": c.yellow,
  "library": c.magenta,
  "gameplay": c.green,
  "unknown": c.dim,
};

// ===== Banner =====
function printBanner() {
  console.log(`
${c.cyan}${c.bold}  ╔══════════════════════════════════════════════╗
  ║     ✨  Stellarlight Extra Spliter v1.0.0  ⛏️     ║
  ║     Classify mods using Modrinth API        ║
  ╚══════════════════════════════════════════════╝${c.reset}
`);
}

// ===== Help =====
function printHelp() {
  printBanner();
  console.log(`${c.bold}USAGE:${c.reset}
  bun run split -- --input <path> --output <path> [options]

${c.bold}OPTIONS:${c.reset}
  ${c.cyan}-i, --input${c.reset}        Path to the mods folder ${c.dim}(required)${c.reset}
  ${c.cyan}-o, --output${c.reset}       Path for the output folder ${c.dim}(required)${c.reset}
  ${c.cyan}-d, --dry-run${c.reset}      Only analyze & report, don't copy files
  ${c.cyan}-f, --format${c.reset}       Report format: json | md | both ${c.dim}(default: both)${c.reset}
  ${c.cyan}-c, --concurrency${c.reset}  Max parallel operations ${c.dim}(default: 10)${c.reset}
  ${c.cyan}-h, --help${c.reset}         Show this help message

${c.bold}EXAMPLES:${c.reset}
  ${c.dim}# Split mods from .minecraft/mods to output folder${c.reset}
  bun run split -- -i ~/.minecraft/mods -o ./sorted-mods

  ${c.dim}# Dry run - only generate report${c.reset}
  bun run split -- -i ./mods -o ./output --dry-run

  ${c.dim}# With custom concurrency${c.reset}
  bun run split -- -i ./mods -o ./output -c 20
`);
}

// ===== Progress Bar =====
function renderProgress(label: string, current: number, total: number) {
  const width = 30;
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(width * pct);
  const empty = width - filled;
  const bar = `${c.bgCyan}${" ".repeat(filled)}${c.reset}${c.dim}${"░".repeat(empty)}${c.reset}`;
  const pctText = `${(pct * 100).toFixed(0)}%`.padStart(4);
  process.stdout.write(`\r  ${bar} ${c.bold}${pctText}${c.reset} ${label}`);
}

// ===== Parse CLI Args =====
function parseCliArgs(): SplitOptions | null {
  try {
    const { values } = parseArgs({
      args: Bun.argv.slice(2),
      options: {
        input: { type: "string", short: "i" },
        output: { type: "string", short: "o" },
        "dry-run": { type: "boolean", short: "d", default: false },
        format: { type: "string", short: "f", default: "both" },
        concurrency: { type: "string", short: "c", default: "10" },
        help: { type: "boolean", short: "h", default: false },
      },
      strict: true,
    });

    if (values.help) {
      printHelp();
      process.exit(0);
    }

    if (!values.input || !values.output) {
      console.log(`${c.red}${c.bold}Error:${c.reset} --input and --output are required\n`);
      printHelp();
      return null;
    }

    const format = values.format as "json" | "md" | "both";
    if (!["json", "md", "both"].includes(format)) {
      console.log(
        `${c.red}${c.bold}Error:${c.reset} --format must be one of: json, md, both\n`
      );
      return null;
    }

    return {
      input: values.input,
      output: values.output,
      dryRun: values["dry-run"] ?? false,
      format,
      concurrency: parseInt(values.concurrency ?? "10", 10),
    };
  } catch (err: any) {
    console.log(`${c.red}${c.bold}Error:${c.reset} ${err.message}\n`);
    printHelp();
    return null;
  }
}

// ===== Main =====
async function main() {
  printBanner();

  const options = parseCliArgs();
  if (!options) process.exit(1);

  const startTime = Date.now();

  const onProgress: ProgressCallback = (event) => {
    renderProgress(event.message, event.current, event.total);
    if (event.percentage === 100 || event.stage === "done" || event.stage === "error") {
      console.log(); // newline after progress completes
    }
  };

  try {
    // Step 1: Scan & hash
    console.log(`${c.cyan}${c.bold}[1/5]${c.reset} 🔍 Scanning mods folder...`);
    const modFiles = await scanMods(options.input, options.concurrency, onProgress);
    console.log(`  ${c.green}✓${c.reset} Found ${c.bold}${modFiles.length}${c.reset} mod files\n`);

    // Step 2: Lookup on Modrinth
    console.log(`${c.cyan}${c.bold}[2/5]${c.reset} 🌐 Looking up mods on Modrinth...`);
    const client = new ModrinthClient();
    const hashes = modFiles.map((f) => f.sha512);
    const versions = await client.getVersionsFromHashes(hashes, onProgress);
    console.log(
      `  ${c.green}✓${c.reset} Matched ${c.bold}${versions.size}${c.reset}/${modFiles.length} mods\n`
    );

    // Step 3: Fetch project details
    console.log(`${c.cyan}${c.bold}[3/5]${c.reset} 📋 Fetching project details...`);
    const projectIds = [...versions.values()].map((v) => v.project_id);
    const projects = await client.getProjects(projectIds, onProgress);
    console.log(
      `  ${c.green}✓${c.reset} Retrieved ${c.bold}${projects.size}${c.reset} project details\n`
    );

    // Step 4: Classify
    console.log(`${c.cyan}${c.bold}[4/5]${c.reset} 🏷️  Classifying mods...`);
    const classified = classifyAll(modFiles, versions, projects);

    // Print summary table
    const summary: Record<ModCategory, number> = {
      "client-side": 0,
      "server-side": 0,
      library: 0,
      gameplay: 0,
      unknown: 0,
    };
    for (const mod of classified) {
      summary[mod.category]++;
    }

    console.log();
    console.log(`  ${c.bold}┌──────────────────────────────────┐${c.reset}`);
    console.log(`  ${c.bold}│      Classification Results      │${c.reset}`);
    console.log(`  ${c.bold}├──────────────────────────────────┤${c.reset}`);
    for (const cat of Object.keys(summary) as ModCategory[]) {
      const count = summary[cat];
      const color = CATEGORY_CLI_COLORS[cat];
      const label = CATEGORY_LABELS[cat].padEnd(20);
      const countStr = String(count).padStart(4);
      const bar = "█".repeat(Math.ceil((count / modFiles.length) * 20));
      console.log(
        `  ${c.bold}│${c.reset} ${color}${label}${c.reset} ${c.bold}${countStr}${c.reset} ${c.dim}${bar}${c.reset}`
      );
    }
    console.log(`  ${c.bold}├──────────────────────────────────┤${c.reset}`);
    console.log(
      `  ${c.bold}│${c.reset}  Total${" ".repeat(17)}${c.bold}${String(modFiles.length).padStart(4)}${c.reset}`
    );
    console.log(`  ${c.bold}└──────────────────────────────────┘${c.reset}`);
    console.log();

    // Step 5: Copy or dry run
    if (options.dryRun) {
      console.log(`${c.yellow}${c.bold}[5/5]${c.reset} 🏃 Dry run — skipping file copy\n`);
    } else {
      console.log(`${c.cyan}${c.bold}[5/5]${c.reset} 📁 Copying files to output...`);
      await splitMods(classified, options.output, options.concurrency, onProgress);
      console.log(
        `  ${c.green}✓${c.reset} Files copied to ${c.bold}${options.output}${c.reset}\n`
      );
    }

    // Generate report
    console.log(`${c.cyan}📝 Generating report...${c.reset}`);
    const report = generateReport(classified, options.input, options.output, startTime);

    if (options.format === "json" || options.format === "both") {
      const jsonPath = await saveJsonReport(report, options.output);
      console.log(`  ${c.green}✓${c.reset} JSON report: ${c.dim}${jsonPath}${c.reset}`);
    }
    if (options.format === "md" || options.format === "both") {
      const mdPath = await saveMarkdownReport(report, options.output);
      console.log(`  ${c.green}✓${c.reset} Markdown report: ${c.dim}${mdPath}${c.reset}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `\n${c.green}${c.bold}✨ Done!${c.reset} Completed in ${c.bold}${elapsed}s${c.reset}\n`
    );
  } catch (err: any) {
    console.log(`\n${c.red}${c.bold}❌ Error:${c.reset} ${err.message}\n`);
    process.exit(1);
  }
}

main();
