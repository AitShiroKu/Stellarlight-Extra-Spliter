<img width="400" height="399" alt="Stellarlight Extra Splitter logo (1)" src="https://github.com/user-attachments/assets/96a7a332-17ed-404b-ae45-3260749aedbf" />

# ⛏️ Stellarlight Extra Splitter | A Minecraft Mod Splitter

**Minecraft Mod Splitter** is a powerful, high-performance tool designed to automatically categorize and sort Minecraft mod files (`.jar`) based on metadata fetched from the **Modrinth API**.

Whether you're managing a server and need to separate client-only mods, or you're a player wanting to organize your library, this tool handles the heavy lifting by scanning file hashes and classifying them into logical folders.

## Web UI Preview
<img width="1753" height="885" alt="image" src="https://github.com/user-attachments/assets/370f01a0-6d30-4ad4-ba23-7031441ec1c1" />
<img width="1753" height="1078" alt="image" src="https://github.com/user-attachments/assets/8e53a064-6767-43bd-8f55-56c04df1f667" />



## ✨ Features

- **🚀 Triple-speed Sorting**: Uses SHA-512 hashing and batch API lookups for maximum efficiency.
- **🏷️ Smart Classification**:
  - `🖥️ Client-Side`: Mods that are only needed on the player's computer.
  - `🖧 Server-Side`: Mods for dedicated servers only.
  - `📚 Library`: Dependency mods and APIs.
  - `🎮 Gameplay`: Content mods needed on both client and server.
  - `❓ Unknown`: Mods that couldn't be indexed (e.g., custom builds or private mods).
- **📊 Automated Reporting**: Generates both structured `report.json` and a beautiful `report.md` summary with statistics and tables.
- **🖥️ Dual Interface**:
  - **Premium CLI**: High-performance terminal interface with real-time progress bars.
  - **Glassmorphism Web UI**: Modern, browser-based dashboard for those who prefer a visual approach.
- **📦 Zero External Dependencies**: Built entirely using Bun's native APIs.

## 🛠️ Requirements

- [Bun](https://bun.sh/) runtime installed on your system.
- Internet connection (to query the Modrinth API).

## 🚀 Getting Started

### Installation

1. Clone or download this project.
2. Open your terminal in the project directory.
3. Install dependencies (none extra needed, but initializes the env):
   ```bash
   bun install
   ```

### Using the CLI

Run the tool via the command line for fast, batch processing:

```bash
bun run split -- -i /path/to/mods -o /path/to/output
```

**Options:**
- `-i, --input`: Path to your `.minecraft/mods` folder.
- `-o, --output`: Where you want the sorted folders and reports created.
- `-d, --dry-run`: Analyze and create reports without actually copying files.
- `-c, --concurrency`: Number of parallel operations (default: 10).
- `-h, --help`: Show help menu.

### Using the Web UI

Prefer a visual dashboard? Start the local server:

```bash
bun run ui
```
Then open **[http://localhost:3000](http://localhost:3000)** in your browser.

## 📂 Project Structure

- `src/scanner.ts`: Fast file scanning and hashing.
- `src/modrinth.ts`: Optimized batch API client with rate-limiting.
- `src/classifier.ts`: Logic for determining mod categories.
- `src/splitter.ts`: High-speed file organization.
- `src/report.ts`: Report generation engine.
- `src/ui/`: Built-in web dashboard server and frontend.

## 🔨 Building & Compiling

You can compile the tool into a standalone binary for your OS:

```bash
# Compile CLI only
bun run compile:cli

# Compile Web UI only
bun run compile:ui
```
Binaries will be located in the `dist/` folder.

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---
*Created with ❤️ by AitShiroKu*
