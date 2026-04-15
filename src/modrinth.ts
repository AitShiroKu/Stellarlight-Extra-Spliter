import type { ModrinthVersion, ModrinthProject, ProgressCallback } from "./types";

const BASE_URL = "https://api.modrinth.com/v2";
const USER_AGENT = "Stellarlight-Extra-Spliter/1.0.0 (github.com/aitshiroku)";
const MAX_PROJECTS_PER_REQUEST = 80; // Modrinth recommends under 100

/**
 * Modrinth API client with batch operations and rate limiting
 */
export class ModrinthClient {
  private requestCount = 0;
  private windowStart = Date.now();

  private async throttle(): Promise<void> {
    this.requestCount++;
    const elapsed = Date.now() - this.windowStart;

    // Modrinth rate limit: ~300 requests/min
    if (this.requestCount >= 280 && elapsed < 60_000) {
      const waitMs = 60_000 - elapsed + 100;
      await Bun.sleep(waitMs);
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    if (elapsed >= 60_000) {
      this.requestCount = 0;
      this.windowStart = Date.now();
    }
  }

  private async fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    await this.throttle();

    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Modrinth API error: ${response.status} ${response.statusText}\n${body}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Batch lookup versions by file SHA-512 hashes.
   * Returns a map of hash → version info.
   */
  async getVersionsFromHashes(
    hashes: string[],
    onProgress?: ProgressCallback
  ): Promise<Map<string, ModrinthVersion>> {
    onProgress?.({
      stage: "lookup",
      message: `Looking up ${hashes.length} mods on Modrinth...`,
      current: 0,
      total: hashes.length,
      percentage: 0,
    });

    const result = await this.fetchJSON<Record<string, ModrinthVersion>>(
      `${BASE_URL}/version_files`,
      {
        method: "POST",
        body: JSON.stringify({
          hashes,
          algorithm: "sha512",
        }),
      }
    );

    const map = new Map<string, ModrinthVersion>();
    for (const [hash, version] of Object.entries(result)) {
      map.set(hash, version);
    }

    onProgress?.({
      stage: "lookup",
      message: `Found ${map.size}/${hashes.length} mods on Modrinth`,
      current: map.size,
      total: hashes.length,
      percentage: 100,
    });

    return map;
  }

  /**
   * Batch fetch multiple projects by their IDs.
   * Auto-chunks if more than MAX_PROJECTS_PER_REQUEST.
   */
  async getProjects(
    projectIds: string[],
    onProgress?: ProgressCallback
  ): Promise<Map<string, ModrinthProject>> {
    const uniqueIds = [...new Set(projectIds)];
    const allProjects = new Map<string, ModrinthProject>();
    const total = uniqueIds.length;

    for (let i = 0; i < total; i += MAX_PROJECTS_PER_REQUEST) {
      const chunk = uniqueIds.slice(i, i + MAX_PROJECTS_PER_REQUEST);
      const idsParam = encodeURIComponent(JSON.stringify(chunk));

      const projects = await this.fetchJSON<ModrinthProject[]>(
        `${BASE_URL}/projects?ids=${idsParam}`
      );

      for (const project of projects) {
        allProjects.set(project.id, project);
      }

      onProgress?.({
        stage: "classifying",
        message: `Fetching project details... ${Math.min(i + MAX_PROJECTS_PER_REQUEST, total)}/${total}`,
        current: Math.min(i + MAX_PROJECTS_PER_REQUEST, total),
        total,
        percentage: Math.round(
          (Math.min(i + MAX_PROJECTS_PER_REQUEST, total) / total) * 100
        ),
      });
    }

    return allProjects;
  }
}
