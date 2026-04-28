import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  CircleDot,
  Container,
  Eye,
  FolderOpen,
  KeyRound,
  MessagesSquare,
  Monitor,
  Plus,
  RefreshCcw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getGuacamoleDpi,
  getGuacamoleTokenFromHost,
  getSSHHosts,
  logActivity,
} from "@/ui/main-axios";
import { useServerStatus } from "@/ui/contexts/ServerStatusContext";
import { QuickConnectDialog } from "@/ui/desktop/navigation/dialogs/QuickConnectDialog";
import { useTabs } from "@/ui/desktop/navigation/tabs/TabContext";
import { DEFAULT_STATS_CONFIG } from "@/types/stats-widgets";
import type { SSHHost } from "@/types";

type HostStatus = "online" | "offline" | "degraded";
type HostFilter = "all" | "online" | "offline" | "pinned";

const statusCopy: Record<HostStatus, string> = {
  online: "Online",
  offline: "Failed",
  degraded: "Checking",
};

const statusDotClass: Record<HostStatus, string> = {
  online: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]",
  offline: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.14)]",
  degraded: "bg-amber-400 shadow-[0_0_0_3px_rgba(245,158,11,0.14)]",
};

const statusTextClass: Record<HostStatus, string> = {
  online: "text-emerald-700",
  offline: "text-rose-700",
  degraded: "text-amber-700",
};

function getStatsConfig(host: SSHHost) {
  if (!host.statsConfig) return DEFAULT_STATS_CONFIG;
  if (typeof host.statsConfig === "object") {
    return { ...DEFAULT_STATS_CONFIG, ...host.statsConfig };
  }
  try {
    return { ...DEFAULT_STATS_CONFIG, ...JSON.parse(host.statsConfig) };
  } catch {
    return DEFAULT_STATS_CONFIG;
  }
}

function hasTunnelConnections(host: SSHHost) {
  if (!host.tunnelConnections) return false;
  if (Array.isArray(host.tunnelConnections)) {
    return host.tunnelConnections.length > 0;
  }
  try {
    const parsed = JSON.parse(host.tunnelConnections as unknown as string);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function getTitle(host: SSHHost) {
  return host.name?.trim() || `${host.username}@${host.ip}`;
}

function getEndpoint(host: SSHHost) {
  return `${host.username}@${host.ip}:${host.port}`;
}

function getLastSeen(lastChecked?: string) {
  if (!lastChecked) return "not checked";
  const timestamp = new Date(lastChecked).getTime();
  if (!Number.isFinite(timestamp)) return "not checked";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function ServerLaunchpad({
  rightSidebarOpen = false,
  rightSidebarWidth = 400,
}: {
  rightSidebarOpen?: boolean;
  rightSidebarWidth?: number;
}): React.ReactElement {
  const { addTab, setCurrentTab, tabs } = useTabs() as {
    addTab: (tab: Record<string, unknown>) => number;
    setCurrentTab: (id: number) => void;
    tabs: Array<{ id: number; type: string }>;
  };
  const { statuses, refreshStatuses, getStatus, isLoading } = useServerStatus();
  const [hosts, setHosts] = useState<SSHHost[]>([]);
  const [hostsError, setHostsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HostFilter>("all");
  const [quickConnectOpen, setQuickConnectOpen] = useState(false);

  const fetchHosts = useCallback(async () => {
    try {
      const data = await getSSHHosts();
      setHosts(data);
      setHostsError(null);
    } catch {
      setHostsError("Could not load saved servers");
    }
  }, []);

  useEffect(() => {
    fetchHosts();
    const onHostsChanged = () => fetchHosts();
    window.addEventListener("ssh-hosts:changed", onHostsChanged);
    window.addEventListener("hosts:refresh", onHostsChanged);
    return () => {
      window.removeEventListener("ssh-hosts:changed", onHostsChanged);
      window.removeEventListener("hosts:refresh", onHostsChanged);
    };
  }, [fetchHosts]);

  const getEffectiveStatus = useCallback(
    (host: SSHHost): HostStatus => {
      const config = getStatsConfig(host);
      if (config.statusCheckEnabled === false) return "offline";
      return getStatus(host.id);
    },
    [getStatus],
  );

  const filteredHosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return hosts
      .filter((host) => {
        const status = getEffectiveStatus(host);
        if (filter === "online" && status !== "online") return false;
        if (filter === "offline" && status !== "offline") return false;
        if (filter === "pinned" && !host.pin) return false;

        if (!normalizedQuery) return true;
        const haystack = [
          host.name,
          host.username,
          host.ip,
          host.port,
          host.folder,
          host.authType,
          host.connectionType || "ssh",
          ...(host.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (a.pin !== b.pin) return a.pin ? -1 : 1;
        const aStatus = getEffectiveStatus(a);
        const bStatus = getEffectiveStatus(b);
        if (aStatus !== bStatus) {
          if (aStatus === "online") return -1;
          if (bStatus === "online") return 1;
        }
        return getTitle(a).localeCompare(getTitle(b));
      });
  }, [filter, getEffectiveStatus, hosts, query]);

  const onlineCount = hosts.filter(
    (host) => getEffectiveStatus(host) === "online",
  ).length;
  const failedCount = hosts.filter(
    (host) => getEffectiveStatus(host) === "offline",
  ).length;
  const pinnedCount = hosts.filter((host) => host.pin).length;
  const recentHosts = filteredHosts.slice(0, 4);

  const openHostManager = (host?: SSHHost, initialTab?: string) => {
    const existing = tabs.find((tab) => tab.type === "ssh_manager");
    if (existing) {
      setCurrentTab(existing.id);
      return;
    }
    addTab({
      type: "ssh_manager",
      title: "Host Manager",
      hostConfig: host,
      initialTab,
    });
  };

  const openHost = async (host: SSHHost) => {
    const title = getTitle(host);

    if (
      host.connectionType === "rdp" ||
      host.connectionType === "vnc" ||
      host.connectionType === "telnet"
    ) {
      try {
        const protocol = host.connectionType;
        const result = await getGuacamoleTokenFromHost(host.id);
        addTab({
          type: protocol,
          title,
          hostConfig: host,
          connectionConfig: {
            token: result.token,
            protocol,
            type: protocol,
            hostname: host.ip,
            port: host.port,
            username: host.username,
            password: host.password,
            domain: host.domain,
            security: host.security,
            "ignore-cert": host.ignoreCert,
            dpi: getGuacamoleDpi(host),
          },
        });
        await logActivity(protocol, host.id, title).catch(() => undefined);
      } catch (error) {
        console.error("Failed to open remote session:", error);
        toast.error("Could not open remote session");
      }
      return;
    }

    addTab({ type: "terminal", title, hostConfig: host });
  };

  const openTool = (host: SSHHost, type: string) => {
    addTab({ type, title: getTitle(host), hostConfig: host });
  };

  const refreshAll = async () => {
    await Promise.all([fetchHosts(), refreshStatuses({ force: true })]);
  };

  return (
    <div
      className="sshbridge-command-deck-bg h-screen overflow-hidden text-foreground"
      style={{
        marginRight: rightSidebarOpen
          ? `var(--right-sidebar-width, ${rightSidebarWidth}px)`
          : 0,
      }}
    >
      <div className="flex h-full flex-col px-5 pb-5 pt-[82px]">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
              <CircleDot className="h-3.5 w-3.5 text-emerald-600" />
              Command deck
            </div>
            <h1 className="text-3xl font-semibold leading-none text-foreground">
              Connect without detours
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              className="h-9 gap-2 border-edge bg-button hover:bg-hover"
              onClick={refreshAll}
              disabled={isLoading}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="h-9 gap-2 border-edge bg-button hover:bg-hover"
              onClick={() => openHostManager(undefined, "hosts")}
            >
              <Settings2 className="h-4 w-4" />
              Manage
            </Button>
            <Button
              className="sshbridge-primary-button h-9 gap-2"
              onClick={() => setQuickConnectOpen(true)}
            >
              <Zap className="h-4 w-4" />
              Quick connect
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-4">
          <main className="flex min-h-0 flex-col gap-3">
            <section className="sshbridge-mini-terminal shrink-0 overflow-hidden rounded-lg border border-black/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-xs text-white/70">
                    session launcher
                  </span>
                </div>
                <span className="rounded border border-white/10 px-2 py-1 font-mono text-[11px] text-white/55">
                  latency 22ms
                </span>
              </div>
              <div className="font-mono text-sm leading-7 text-white/82">
                <div>
                  <span className="text-emerald-300">$</span> sshbridge connect
                  {recentHosts[0] ? ` ${getTitle(recentHosts[0])}` : " server"}
                </div>
                <div className="text-white/45">
                  resolving key, keeping session warm, attaching terminal...
                </div>
                <div className="mt-1 inline-flex rounded-md bg-white/8 px-2 py-1 text-xs text-white/70">
                  Open app / tap one server / terminal
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-edge-panel bg-elevated/90">
              <div className="flex shrink-0 items-center gap-3 border-b border-edge-panel p-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search host, user, tag, folder"
                    className="h-10 border-edge bg-surface pl-9 text-sm text-foreground placeholder:text-foreground-subtle shadow-none focus-visible:border-edge-active focus-visible:ring-ring/20"
                    autoComplete="off"
                  />
                </div>
                <div className="flex shrink-0 rounded-md border border-edge bg-surface p-1">
                  {(
                    [
                      ["all", "All"],
                      ["online", "Online"],
                      ["offline", "Failed"],
                      ["pinned", "Pinned"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={cn(
                        "h-8 rounded px-3 text-xs font-semibold text-foreground-secondary transition-colors",
                        filter === value
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-surface-hover",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {hostsError && (
                <div className="m-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                  {hostsError}
                </div>
              )}

              <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
                {filteredHosts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <Server className="h-10 w-10 text-foreground-subtle" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        No matching servers
                      </div>
                      <div className="mt-1 text-xs text-foreground-subtle">
                        Add a host or adjust the current filter.
                      </div>
                    </div>
                    <Button
                      className="sshbridge-primary-button h-9 gap-2"
                      onClick={() => openHostManager(undefined, "hosts")}
                    >
                      <Plus className="h-4 w-4" />
                      Add host
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredHosts.map((host) => {
                      const status = getEffectiveStatus(host);
                      const lastChecked = statuses.get(host.id)?.lastChecked;
                      const isSSH =
                        !host.connectionType || host.connectionType === "ssh";
                      const showFileManager =
                        isSSH && host.enableFileManager !== false;
                      const showTunnel =
                        isSSH &&
                        host.enableTunnel !== false &&
                        hasTunnelConnections(host);
                      const showDocker = isSSH && host.enableDocker === true;
                      const showStats =
                        isSSH && getStatsConfig(host).metricsEnabled !== false;
                      const typeLabel = host.connectionType || "ssh";

                      return (
                        <div
                          key={host.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openHost(host)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openHost(host);
                            }
                          }}
                          className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-edge bg-[#f7f4ed] px-3 py-2.5 outline-none transition-colors hover:border-edge-hover hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-edge bg-elevated">
                              {host.connectionType === "rdp" ? (
                                <Monitor className="h-4 w-4" />
                              ) : host.connectionType === "vnc" ? (
                                <Eye className="h-4 w-4" />
                              ) : host.connectionType === "telnet" ? (
                                <MessagesSquare className="h-4 w-4" />
                              ) : (
                                <Terminal className="h-4 w-4" />
                              )}
                              <span
                                className={cn(
                                  "absolute right-1.5 top-1.5 h-2 w-2 rounded-full",
                                  statusDotClass[status],
                                )}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h2 className="truncate text-sm font-semibold text-foreground">
                                  {getTitle(host)}
                                </h2>
                                {host.pin && (
                                  <span className="rounded border border-edge px-1.5 py-0.5 text-[10px] text-foreground-subtle">
                                    pinned
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate font-mono text-xs text-foreground-secondary">
                                {getEndpoint(host)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="hidden items-center gap-1.5 xl:flex">
                              <span
                                className={cn(
                                  "rounded border border-edge bg-elevated px-1.5 py-0.5 text-[11px] font-semibold",
                                  statusTextClass[status],
                                )}
                              >
                                {statusCopy[status]}
                              </span>
                              <span className="rounded border border-edge bg-elevated px-1.5 py-0.5 text-[11px] text-foreground-subtle">
                                {typeLabel}
                              </span>
                              {host.authType && (
                                <span className="inline-flex items-center gap-1 rounded border border-edge bg-elevated px-1.5 py-0.5 text-[11px] text-foreground-subtle">
                                  <KeyRound className="h-3 w-3" />
                                  {host.authType}
                                </span>
                              )}
                              <span className="text-[11px] text-foreground-subtle">
                                {getLastSeen(lastChecked)}
                              </span>
                            </div>

                            <div
                              className="flex shrink-0 items-center gap-1"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {showStats && (
                                <Button
                                  variant="outline"
                                  className="h-8 w-8 border-edge bg-button p-0 hover:bg-hover"
                                  title="Stats"
                                  onClick={() => openTool(host, "server_stats")}
                                >
                                  <Activity className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {showFileManager && (
                                <Button
                                  variant="outline"
                                  className="h-8 w-8 border-edge bg-button p-0 hover:bg-hover"
                                  title="Files"
                                  onClick={() => openTool(host, "file_manager")}
                                >
                                  <FolderOpen className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {showTunnel && (
                                <Button
                                  variant="outline"
                                  className="h-8 w-8 border-edge bg-button p-0 hover:bg-hover"
                                  title="Tunnel"
                                  onClick={() => openTool(host, "tunnel")}
                                >
                                  <ArrowDownUp className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {showDocker && (
                                <Button
                                  variant="outline"
                                  className="h-8 w-8 border-edge bg-button p-0 hover:bg-hover"
                                  title="Docker"
                                  onClick={() => openTool(host, "docker")}
                                >
                                  <Container className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                className="sshbridge-primary-button h-8 w-8 p-0"
                                title="Connect"
                                onClick={() => openHost(host)}
                              >
                                <Terminal className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </main>

          <aside className="flex min-h-0 flex-col gap-3">
            <section className="rounded-lg border border-edge-panel bg-elevated/90 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Fleet</h2>
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-edge bg-surface p-3">
                  <div className="text-xl font-semibold">{hosts.length}</div>
                  <div className="mt-1 text-[11px] text-foreground-subtle">
                    Saved
                  </div>
                </div>
                <div className="rounded-md border border-edge bg-surface p-3">
                  <div className="text-xl font-semibold text-emerald-700">
                    {onlineCount}
                  </div>
                  <div className="mt-1 text-[11px] text-foreground-subtle">
                    Online
                  </div>
                </div>
                <div className="rounded-md border border-edge bg-surface p-3">
                  <div className="text-xl font-semibold text-rose-700">
                    {failedCount}
                  </div>
                  <div className="mt-1 text-[11px] text-foreground-subtle">
                    Failed
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-edge-panel bg-elevated/90 p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Fast lane
              </h2>
              <div className="space-y-2">
                <Button
                  className="sshbridge-primary-button h-10 w-full justify-start gap-2"
                  onClick={() => setQuickConnectOpen(true)}
                >
                  <Zap className="h-4 w-4" />
                  Quick connect
                </Button>
                <Button
                  variant="outline"
                  className="h-10 w-full justify-start gap-2 border-edge bg-button hover:bg-hover"
                  onClick={() => openHostManager(undefined, "hosts")}
                >
                  <Plus className="h-4 w-4" />
                  Add saved server
                </Button>
              </div>
            </section>

            <section className="thin-scrollbar min-h-0 flex-1 overflow-y-auto rounded-lg border border-edge-panel bg-elevated/90 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  One-tap targets
                </h2>
                <span className="text-xs text-foreground-subtle">
                  {pinnedCount} pinned
                </span>
              </div>
              <div className="space-y-2">
                {recentHosts.map((host) => {
                  const status = getEffectiveStatus(host);
                  return (
                    <button
                      key={host.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border border-edge bg-surface px-3 py-2 text-left hover:bg-surface-hover"
                      onClick={() => openHost(host)}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          statusDotClass[status],
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {getTitle(host)}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-foreground-subtle">
                          {host.ip}:{host.port}
                        </span>
                      </span>
                      <Terminal className="h-4 w-4 text-foreground-subtle" />
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <QuickConnectDialog
        open={quickConnectOpen}
        onOpenChange={setQuickConnectOpen}
      />
    </div>
  );
}
