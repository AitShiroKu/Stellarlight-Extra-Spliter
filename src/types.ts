// ===== Mod Categories =====
export type ModCategory = "client-side" | "server-side" | "library" | "gameplay" | "unknown";

export const CATEGORY_LABELS: Record<ModCategory, string> = {
  "client-side": "🖥️  Client-Side",
  "server-side": "🖧  Server-Side",
  "library": "📚 Library",
  "gameplay": "🎮 Gameplay (Both)",
  "unknown": "❓ Unknown",
};

export const CATEGORY_COLORS: Record<ModCategory, string> = {
  "client-side": "#60a5fa",
  "server-side": "#f97316",
  "library": "#a78bfa",
  "gameplay": "#34d399",
  "unknown": "#6b7280",
};

// ===== Mod Info =====
export interface ModFile {
  filename: string;
  filepath: string;
  size: number;
  sha512: string;
}

export interface ClassifiedMod {
  file: ModFile;
  category: ModCategory;
  project?: ModrinthProject;
  version?: ModrinthVersion;
  loaders: string[];
  gameVersions: string[];
  modrinthUrl?: string;
}

// ===== Modrinth API Types =====
export interface ModrinthVersionFile {
  hashes: {
    sha512: string;
    sha1: string;
  };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModrinthDependency {
  version_id: string | null;
  project_id: string | null;
  file_name: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  author_id: string;
  name: string;
  version_number: string;
  changelog: string;
  dependencies: ModrinthDependency[];
  game_versions: string[];
  version_type: "release" | "beta" | "alpha";
  loaders: string[];
  featured: boolean;
  status: string;
  files: ModrinthVersionFile[];
  date_published: string;
  downloads: number;
}

export type SideSupport = "required" | "optional" | "unsupported";

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: SideSupport;
  server_side: SideSupport;
  project_type: string;
  downloads: number;
  icon_url: string | null;
  color: number | null;
  versions: string[];
  loaders?: string[];
}

// ===== Report =====
export interface SplitReport {
  timestamp: string;
  inputPath: string;
  outputPath: string;
  totalMods: number;
  summary: Record<ModCategory, number>;
  detectedLoaders: string[];
  detectedGameVersions: string[];
  mods: ClassifiedMod[];
  unknownMods: ModFile[];
  duration: number;
}

// ===== CLI Options =====
export interface SplitOptions {
  input: string;
  output: string;
  dryRun: boolean;
  format: "json" | "md" | "both";
  concurrency: number;
}

// ===== Progress =====
export interface ProgressEvent {
  stage: "scanning" | "hashing" | "lookup" | "classifying" | "copying" | "report" | "done" | "error";
  message: string;
  current: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (event: ProgressEvent) => void;
