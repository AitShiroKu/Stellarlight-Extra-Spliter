import { resolve, join } from "path";
import { scanMods } from "../scanner";
import { ModrinthClient } from "../modrinth";
import { classifyAll } from "../classifier";
import { splitMods } from "../splitter";
import {
  generateReport,
  saveJsonReport,
  saveMarkdownReport,
} from "../report";
import { formatSize } from "../scanner";
import type { ProgressEvent, SplitReport, ClassifiedMod } from "../types";

const PORT = 3000;
const PUBLIC_DIR = resolve(import.meta.dir, "public");

// Store last report for the UI
let lastReport: SplitReport | null = null;
let activeListeners: Set<ReadableStreamDefaultController> = new Set();

function broadcast(event: ProgressEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const controller of activeListeners) {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch {
      activeListeners.delete(controller);
    }
  }
}

async function handleSplit(body: {
  input: string;
  output: string;
  dryRun?: boolean;
  format?: string;
  concurrency?: number;
}) {
  const startTime = Date.now();
  const concurrency = body.concurrency ?? 10;

  try {
    // Scan
    broadcast({
      stage: "scanning",
      message: "Scanning for .jar files...",
      current: 0,
      total: 0,
      percentage: 0,
    });

    const modFiles = await scanMods(body.input, concurrency, broadcast);

    // Hash lookup
    const client = new ModrinthClient();
    const hashes = modFiles.map((f) => f.sha512);
    const versions = await client.getVersionsFromHashes(hashes, broadcast);

    // Project details
    const projectIds = [...versions.values()].map((v) => v.project_id);
    const projects = await client.getProjects(projectIds, broadcast);

    // Classify
    broadcast({
      stage: "classifying",
      message: "Classifying mods...",
      current: 0,
      total: modFiles.length,
      percentage: 50,
    });

    const classified = classifyAll(modFiles, versions, projects);

    // Copy files
    if (!body.dryRun) {
      await splitMods(classified, body.output, concurrency, broadcast);
    }

    // Generate report
    broadcast({
      stage: "report",
      message: "Generating report...",
      current: 0,
      total: 1,
      percentage: 90,
    });

    const report = generateReport(
      classified,
      body.input,
      body.output,
      startTime
    );
    lastReport = report;

    const format = body.format ?? "both";
    if (format === "json" || format === "both") {
      await saveJsonReport(report, body.output);
    }
    if (format === "md" || format === "both") {
      await saveMarkdownReport(report, body.output);
    }

    broadcast({
      stage: "done",
      message: `Completed! ${classified.length} mods classified in ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      current: classified.length,
      total: classified.length,
      percentage: 100,
    });
  } catch (err: any) {
    broadcast({
      stage: "error",
      message: err.message,
      current: 0,
      total: 0,
      percentage: 0,
    });
  }
}

// ===== Bun HTTP Server =====
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (url.pathname === "/api/split" && req.method === "POST") {
      const body = await req.json();
      // Run async without blocking response
      handleSplit(body);
      return Response.json(
        { status: "started" },
        { headers: corsHeaders }
      );
    }

    if (url.pathname === "/api/events") {
      // SSE endpoint
      const stream = new ReadableStream({
        start(controller) {
          activeListeners.add(controller);
          // Send initial connection event
          const data = `data: ${JSON.stringify({ stage: "connected", message: "Connected to server", current: 0, total: 0, percentage: 0 })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));

          // Cleanup on close
          req.signal.addEventListener("abort", () => {
            activeListeners.delete(controller);
            try {
              controller.close();
            } catch {}
          });
        },
        cancel() {
          // Cleanup handled by abort listener
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...corsHeaders,
        },
      });
    }

    if (url.pathname === "/api/report") {
      if (!lastReport) {
        return Response.json(
          { error: "No report available" },
          { status: 404, headers: corsHeaders }
        );
      }
      // Return simplified report for UI
      const uiReport = {
        timestamp: lastReport.timestamp,
        totalMods: lastReport.totalMods,
        summary: lastReport.summary,
        detectedLoaders: lastReport.detectedLoaders,
        detectedGameVersions: lastReport.detectedGameVersions,
        duration: lastReport.duration,
        mods: lastReport.mods.map((m) => ({
          filename: m.file.filename,
          size: m.file.size,
          sizeFormatted: formatSize(m.file.size),
          category: m.category,
          projectTitle: m.project?.title ?? null,
          projectSlug: m.project?.slug ?? null,
          modrinthUrl: m.modrinthUrl ?? null,
          clientSide: m.project?.client_side ?? null,
          serverSide: m.project?.server_side ?? null,
          categories: m.project?.categories ?? [],
          loaders: m.loaders,
          iconUrl: m.project?.icon_url ?? null,
        })),
      };
      return Response.json(uiReport, { headers: corsHeaders });
    }

    // Static files
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = join(PUBLIC_DIR, filePath);

    const file = Bun.file(fullPath);
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": getContentType(fullPath),
          ...corsHeaders,
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  return "text/plain; charset=utf-8";
}

console.log(`
\x1b[36m\x1b[1m  🌌 Stellarlight Extra Splitter — Web UI\x1b[0m
\x1b[32m  ➜  http://localhost:${PORT}\x1b[0m
\x1b[2m  Press Ctrl+C to stop\x1b[0m
`);
