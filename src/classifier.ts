import type {
  ModFile,
  ModCategory,
  ClassifiedMod,
  ModrinthVersion,
  ModrinthProject,
} from "./types";

/**
 * Classify a mod based on Modrinth project data.
 *
 * Priority:
 * 1. Library — if categories contain "library"
 * 2. Client-Side — client_side != "unsupported" AND server_side == "unsupported"
 * 3. Server-Side — server_side != "unsupported" AND client_side == "unsupported"
 * 4. Gameplay (Both) — both sides supported
 * 5. Unknown — no data available
 */
export function classifyMod(
  file: ModFile,
  version?: ModrinthVersion,
  project?: ModrinthProject
): ClassifiedMod {
  if (!project || !version) {
    return {
      file,
      category: "unknown",
      loaders: version?.loaders ?? [],
      gameVersions: version?.game_versions ?? [],
    };
  }

  const category = determineCategory(project);

  return {
    file,
    category,
    project,
    version,
    loaders: version.loaders ?? [],
    gameVersions: version.game_versions ?? [],
    modrinthUrl: `https://modrinth.com/mod/${project.slug}`,
  };
}

function determineCategory(project: ModrinthProject): ModCategory {
  // Check library first — many libs have both sides as required
  const categories = project.categories.map((c) => c.toLowerCase());
  if (categories.includes("library")) {
    return "library";
  }

  const { client_side, server_side } = project;

  // Client-only: client supported, server unsupported
  if (client_side !== "unsupported" && server_side === "unsupported") {
    return "client-side";
  }

  // Server-only: server supported, client unsupported
  if (server_side !== "unsupported" && client_side === "unsupported") {
    return "server-side";
  }

  // Both sides supported = gameplay mod
  if (client_side !== "unsupported" && server_side !== "unsupported") {
    return "gameplay";
  }

  return "unknown";
}

/**
 * Batch classify all mod files using pre-fetched version and project data.
 */
export function classifyAll(
  files: ModFile[],
  versions: Map<string, ModrinthVersion>,
  projects: Map<string, ModrinthProject>
): ClassifiedMod[] {
  return files.map((file) => {
    const version = versions.get(file.sha512);
    const project = version ? projects.get(version.project_id) : undefined;
    return classifyMod(file, version, project);
  });
}
