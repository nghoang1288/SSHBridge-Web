export type CommandAutocompleteSource = "history" | "snippet" | "common";

export interface CommandAutocompleteSuggestion {
  value: string;
  label: string;
  description?: string;
  source: CommandAutocompleteSource;
}

export interface SnippetAutocompleteSource {
  name?: string | null;
  content?: string | null;
  description?: string | null;
  folder?: string | null;
}

interface RankedSuggestion extends CommandAutocompleteSuggestion {
  score: number;
}

const COMMON_COMMANDS: CommandAutocompleteSuggestion[] = [
  { value: "ls -la", label: "ls -la", description: "List files with details", source: "common" },
  { value: "cd ..", label: "cd ..", description: "Go to parent directory", source: "common" },
  { value: "pwd", label: "pwd", description: "Print current directory", source: "common" },
  { value: "mkdir -p ", label: "mkdir -p", description: "Create directory tree", source: "common" },
  { value: "cp -r ", label: "cp -r", description: "Copy files or directories", source: "common" },
  { value: "mv ", label: "mv", description: "Move or rename files", source: "common" },
  { value: "rm -rf ", label: "rm -rf", description: "Remove recursively", source: "common" },
  { value: "cat ", label: "cat", description: "Print file contents", source: "common" },
  { value: "less ", label: "less", description: "View a file interactively", source: "common" },
  { value: "tail -f ", label: "tail -f", description: "Follow log output", source: "common" },
  { value: "grep -R \"\" .", label: "grep -R", description: "Search recursively", source: "common" },
  { value: "find . -name \"\"", label: "find", description: "Find files by name", source: "common" },
  { value: "chmod +x ", label: "chmod +x", description: "Make a file executable", source: "common" },
  { value: "chown -R ", label: "chown -R", description: "Change ownership recursively", source: "common" },
  { value: "ps aux", label: "ps aux", description: "List running processes", source: "common" },
  { value: "top", label: "top", description: "Monitor processes", source: "common" },
  { value: "htop", label: "htop", description: "Interactive process monitor", source: "common" },
  { value: "df -h", label: "df -h", description: "Show disk usage", source: "common" },
  { value: "du -sh *", label: "du -sh *", description: "Show folder sizes", source: "common" },
  { value: "free -h", label: "free -h", description: "Show memory usage", source: "common" },
  { value: "uptime", label: "uptime", description: "Show uptime and load", source: "common" },
  { value: "journalctl -xe", label: "journalctl -xe", description: "Inspect systemd logs", source: "common" },
  { value: "journalctl -u ", label: "journalctl -u", description: "Inspect service logs", source: "common" },
  { value: "systemctl status ", label: "systemctl status", description: "Check service status", source: "common" },
  { value: "sudo systemctl restart ", label: "systemctl restart", description: "Restart a service", source: "common" },
  { value: "sudo systemctl enable --now ", label: "systemctl enable", description: "Enable and start a service", source: "common" },
  { value: "sudo apt update", label: "apt update", description: "Refresh apt package lists", source: "common" },
  { value: "sudo apt upgrade", label: "apt upgrade", description: "Upgrade apt packages", source: "common" },
  { value: "sudo apt install ", label: "apt install", description: "Install an apt package", source: "common" },
  { value: "docker ps", label: "docker ps", description: "List running containers", source: "common" },
  { value: "docker ps -a", label: "docker ps -a", description: "List all containers", source: "common" },
  { value: "docker logs -f ", label: "docker logs -f", description: "Follow container logs", source: "common" },
  { value: "docker exec -it ", label: "docker exec -it", description: "Open a shell in a container", source: "common" },
  { value: "docker compose up -d", label: "docker compose up -d", description: "Start compose stack", source: "common" },
  { value: "docker compose down", label: "docker compose down", description: "Stop compose stack", source: "common" },
  { value: "docker compose logs -f", label: "docker compose logs -f", description: "Follow compose logs", source: "common" },
  { value: "git status", label: "git status", description: "Show git status", source: "common" },
  { value: "git pull", label: "git pull", description: "Pull latest changes", source: "common" },
  { value: "git fetch --all --prune", label: "git fetch --all --prune", description: "Refresh remotes", source: "common" },
  { value: "git log --oneline --decorate --graph --max-count=20", label: "git log graph", description: "Compact commit graph", source: "common" },
  { value: "tar -czf archive.tar.gz ", label: "tar -czf", description: "Create gzip archive", source: "common" },
  { value: "tar -xzf ", label: "tar -xzf", description: "Extract gzip archive", source: "common" },
  { value: "unzip ", label: "unzip", description: "Extract zip archive", source: "common" },
  { value: "curl -I ", label: "curl -I", description: "Fetch HTTP headers", source: "common" },
  { value: "curl -L ", label: "curl -L", description: "Follow redirects", source: "common" },
  { value: "wget ", label: "wget", description: "Download a URL", source: "common" },
  { value: "rsync -avz ", label: "rsync -avz", description: "Sync files over SSH", source: "common" },
  { value: "scp ", label: "scp", description: "Copy files over SSH", source: "common" },
  { value: "ssh ", label: "ssh", description: "Open SSH connection", source: "common" },
  { value: "ip addr", label: "ip addr", description: "Show network addresses", source: "common" },
  { value: "ip route", label: "ip route", description: "Show routes", source: "common" },
  { value: "ss -tulpn", label: "ss -tulpn", description: "Show listening sockets", source: "common" },
  { value: "ping -c 4 ", label: "ping -c 4", description: "Test connectivity", source: "common" },
  { value: "traceroute ", label: "traceroute", description: "Trace network route", source: "common" },
  { value: "nc -vz ", label: "nc -vz", description: "Test TCP port", source: "common" },
];

export function isCommandAutocompleteEnabled(defaultEnabled = true): boolean {
  if (typeof window === "undefined") return defaultEnabled;
  const saved = window.localStorage.getItem("commandAutocomplete");
  return saved === null ? defaultEnabled : saved === "true";
}

export function shouldRefreshAutocompleteForInput(data: string): boolean {
  if (!data) return false;
  if (data.includes("\r") || data.includes("\n")) return false;
  if (data.includes("\x1b")) return false;
  if (data === "\x7f" || data === "\b") return true;
  return /^[\x20-\x7e]+$/.test(data);
}

export function getAutocompleteInsertText(
  currentCommand: string,
  selectedCommand: string,
): string {
  if (
    selectedCommand.toLowerCase().startsWith(currentCommand.toLowerCase())
  ) {
    return selectedCommand.slice(currentCommand.length);
  }

  return `\x15${selectedCommand}`;
}

export function buildCommandAutocompleteSuggestions(
  input: string,
  options: {
    history?: string[];
    snippets?: SnippetAutocompleteSource[];
    limit?: number;
  } = {},
): CommandAutocompleteSuggestion[] {
  const query = input.trim();
  if (query.length === 0) return [];

  const ranked: RankedSuggestion[] = [];

  for (const command of options.history || []) {
    const value = normalizeCommand(command);
    if (!value) continue;
    addCandidate(ranked, query, {
      value,
      label: value,
      source: "history",
    });
  }

  for (const snippet of options.snippets || []) {
    const value = firstExecutableLine(snippet.content);
    if (!value) continue;

    addCandidate(ranked, query, {
      value,
      label: snippet.name?.trim() || value,
      description: snippet.description?.trim() || snippet.folder?.trim() || "Snippet",
      source: "snippet",
    });
  }

  for (const command of COMMON_COMMANDS) {
    addCandidate(ranked, query, command);
  }

  const bestByValue = new Map<string, RankedSuggestion>();
  for (const suggestion of ranked) {
    const key = suggestion.value.toLowerCase();
    const existing = bestByValue.get(key);
    if (!existing || suggestion.score < existing.score) {
      bestByValue.set(key, suggestion);
    }
  }

  return Array.from(bestByValue.values())
    .sort((a, b) => a.score - b.score || a.value.length - b.value.length)
    .slice(0, options.limit || 8)
    .map(({ score: _score, ...suggestion }) => suggestion);
}

function addCandidate(
  target: RankedSuggestion[],
  query: string,
  suggestion: CommandAutocompleteSuggestion,
) {
  const value = normalizeCommand(suggestion.value);
  if (!value || value === query) return;

  const score = getScore(query, {
    value,
    label: suggestion.label,
    description: suggestion.description,
    source: suggestion.source,
  });

  if (score === null) return;

  target.push({
    ...suggestion,
    value,
    label: suggestion.label || value,
    score,
  });
}

function getScore(
  query: string,
  suggestion: CommandAutocompleteSuggestion,
): number | null {
  const q = query.toLowerCase();
  const value = suggestion.value.toLowerCase();
  const label = suggestion.label.toLowerCase();
  const description = suggestion.description?.toLowerCase() || "";
  const firstToken = value.split(/\s+/)[0] || "";

  let score: number | null = null;
  if (value.startsWith(q)) score = 0;
  else if (firstToken.startsWith(q)) score = 1;
  else if (label.startsWith(q)) score = 2;
  else if (q.length >= 2 && value.includes(q)) score = 4;
  else if (q.length >= 2 && label.includes(q)) score = 5;
  else if (q.length >= 3 && description.includes(q)) score = 7;

  if (score === null) return null;

  const sourceOffset: Record<CommandAutocompleteSource, number> = {
    history: 0,
    snippet: 0.25,
    common: 0.5,
  };

  return score + sourceOffset[suggestion.source];
}

function normalizeCommand(command: unknown): string {
  return typeof command === "string" ? command.trim() : "";
}

function firstExecutableLine(content: unknown): string {
  if (typeof content !== "string") return "";
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  return lines.find((line) => line.trim().length > 0)?.trim() || "";
}
