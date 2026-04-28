import React, { useEffect, useState, useMemo } from "react";
import { Status, StatusIndicator } from "@/components/ui/shadcn-io/status";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  EllipsisVertical,
  Terminal,
  Monitor,
  Eye,
  MessagesSquare,
  Server,
  FolderOpen,
  Pencil,
  ArrowDownUp,
  Container,
  Power,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useTabs } from "@/ui/desktop/navigation/tabs/TabContext";
import {
  getSSHHosts,
  getGuacamoleToken,
  getGuacamoleDpi,
  getGuacamoleTokenFromHost,
  logActivity,
  wakeOnLan,
} from "@/ui/main-axios";
import type { HostProps } from "../../../../types";
import { DEFAULT_STATS_CONFIG } from "@/types/stats-widgets";
import { useTranslation } from "react-i18next";
import { useHostStatus } from "@/ui/contexts/ServerStatusContext";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

export function Host({ host: initialHost }: HostProps): React.ReactElement {
  const { addTab } = useTabs();
  const [host, setHost] = useState(initialHost);
  const { t } = useTranslation();
  const [showTags, setShowTags] = useState<boolean>(() => {
    const saved = localStorage.getItem("showHostTags");
    return saved !== null ? saved === "true" : true;
  });
  const tags = Array.isArray(host.tags) ? host.tags : [];
  const hasTags = tags.length > 0;

  const title = host.name?.trim()
    ? host.name
    : `${host.username}@${host.ip}:${host.port}`;
  const endpoint = `${host.username}@${host.ip}:${host.port}`;

  useEffect(() => {
    setHost(initialHost);
  }, [initialHost]);

  const hostIdRef = React.useRef(host.id);

  React.useEffect(() => {
    hostIdRef.current = host.id;
  });

  React.useEffect(() => {
    const handleHostsChanged = async () => {
      const hosts = await getSSHHosts();
      const updatedHost = hosts.find((h) => h.id === hostIdRef.current);
      if (updatedHost) {
        setHost(updatedHost);
      }
    };

    window.addEventListener("ssh-hosts:changed", handleHostsChanged);
    return () =>
      window.removeEventListener("ssh-hosts:changed", handleHostsChanged);
  }, []);

  useEffect(() => {
    const handleShowTagsChanged = () => {
      const saved = localStorage.getItem("showHostTags");
      setShowTags(saved !== null ? saved === "true" : true);
    };

    window.addEventListener("showHostTagsChanged", handleShowTagsChanged);
    return () =>
      window.removeEventListener("showHostTagsChanged", handleShowTagsChanged);
  }, []);

  const statsConfig = useMemo(() => {
    if (!host.statsConfig) {
      return DEFAULT_STATS_CONFIG;
    }
    if (typeof host.statsConfig === "object") {
      return host.statsConfig;
    }
    try {
      return JSON.parse(host.statsConfig);
    } catch (e) {
      return DEFAULT_STATS_CONFIG;
    }
  }, [host.statsConfig]);
  const shouldShowStatus = ![false, "false"].includes(
    statsConfig.statusCheckEnabled,
  );
  const shouldShowMetrics = statsConfig.metricsEnabled !== false;

  const serverStatus = useHostStatus(host.id, shouldShowStatus);

  const hasTunnelConnections = useMemo(() => {
    if (!host.tunnelConnections) return false;
    try {
      const tunnelConnections = Array.isArray(host.tunnelConnections)
        ? host.tunnelConnections
        : JSON.parse(host.tunnelConnections);
      return Array.isArray(tunnelConnections) && tunnelConnections.length > 0;
    } catch {
      return false;
    }
  }, [host.tunnelConnections]);

  const handleTerminalClick = async () => {
    if (
      host.connectionType === "rdp" ||
      host.connectionType === "vnc" ||
      host.connectionType === "telnet"
    ) {
      try {
        const protocol = host.connectionType as "rdp" | "vnc" | "telnet";
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

        try {
          await logActivity(protocol, host.id, title);
        } catch (err) {
          console.warn(`Failed to log ${protocol} activity:`, err);
        }
      } catch (err) {
        console.error("Failed to get Guacamole token:", err);
      }
      return;
    }
    addTab({ type: "terminal", title, hostConfig: host });
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTerminalClick();
    }
  };

  const isSSH = !host.connectionType || host.connectionType === "ssh";
  const canOpenTunnel = host.enableTunnel !== false && hasTunnelConnections;
  const showTunnelShortcut = isSSH && (host.showTunnelInSidebar ?? false);
  const tunnelActionLabel = canOpenTunnel
    ? t("hosts.openTunnels")
    : "Configure tunnels";

  const handleTunnelClick = () => {
    if (canOpenTunnel) {
      addTab({ type: "tunnel", title, hostConfig: host });
      return;
    }

    addTab({
      type: "ssh_manager",
      title: t("nav.hostManager"),
      hostConfig: host,
      initialTab: "tunnel",
    });
  };

  const visibleButtons = [
    host.enableTerminal && (host.showTerminalInSidebar ?? true),
    isSSH && host.enableFileManager && (host.showFileManagerInSidebar ?? false),
    showTunnelShortcut,
    isSSH && host.enableDocker && (host.showDockerInSidebar ?? false),
    isSSH && shouldShowMetrics && (host.showServerStatsInSidebar ?? false),
  ].filter(Boolean).length;

  return (
    <div
      role="button"
      tabIndex={0}
      className="group rounded-md px-2 py-2 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handleTerminalClick}
      onKeyDown={handleRowKeyDown}
      title={t("hosts.openTerminal")}
    >
      <div className="flex items-center gap-2">
        {shouldShowStatus && (
          <Status
            status={serverStatus}
            className="!bg-transparent !p-0.75 flex-shrink-0"
          >
            <StatusIndicator />
          </Status>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {host.name || host.ip}
          </p>
          <p className="truncate text-xs text-foreground-subtle">{endpoint}</p>
        </div>

        <ButtonGroup className="flex-shrink-0">
          {host.enableTerminal && (host.showTerminalInSidebar ?? true) && (
            <Button
              variant="outline"
              className="h-8 border border-edge bg-button !px-2 hover:bg-hover"
              onClick={(event) => {
                event.stopPropagation();
                handleTerminalClick();
              }}
            >
              {host.connectionType === "rdp" ? (
                <Monitor />
              ) : host.connectionType === "vnc" ? (
                <Eye />
              ) : host.connectionType === "telnet" ? (
                <MessagesSquare />
              ) : (
                <Terminal />
              )}
            </Button>
          )}

          {isSSH &&
            host.enableFileManager &&
            (host.showFileManagerInSidebar ?? false) && (
              <Button
                variant="outline"
                className="h-8 border border-edge bg-button !px-2 hover:bg-hover"
                onClick={(event) => {
                  event.stopPropagation();
                  addTab({ type: "file_manager", title, hostConfig: host });
                }}
              >
                <FolderOpen />
              </Button>
            )}

          {showTunnelShortcut && (
            <Button
              variant="outline"
              className="h-8 border border-edge bg-button !px-2 hover:bg-hover"
              title={tunnelActionLabel}
              onClick={(event) => {
                event.stopPropagation();
                handleTunnelClick();
              }}
            >
              <ArrowDownUp />
            </Button>
          )}

          {isSSH &&
            host.enableDocker &&
            (host.showDockerInSidebar ?? false) && (
              <Button
                variant="outline"
                className="h-8 border border-edge bg-button !px-2 hover:bg-hover"
                onClick={(event) => {
                  event.stopPropagation();
                  addTab({ type: "docker", title, hostConfig: host });
                }}
              >
                <Container />
              </Button>
            )}

          {isSSH &&
            shouldShowMetrics &&
            (host.showServerStatsInSidebar ?? false) && (
              <Button
                variant="outline"
                className="h-8 border border-edge bg-button !px-2 hover:bg-hover"
                onClick={(event) => {
                  event.stopPropagation();
                  addTab({ type: "server_stats", title, hostConfig: host });
                }}
              >
                <Server />
              </Button>
            )}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-8 border border-edge bg-button !px-2 hover:bg-hover",
                  visibleButtons > 0 && "rounded-l-none border-l-0",
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              side="right"
              className="w-56 border-edge bg-popover text-popover-foreground"
            >
              {host.enableTerminal && !(host.showTerminalInSidebar ?? true) && (
                <DropdownMenuItem
                  onClick={handleTerminalClick}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground-secondary hover:bg-hover"
                >
                  {host.connectionType === "rdp" ? (
                    <Monitor className="h-4 w-4" />
                  ) : host.connectionType === "vnc" ? (
                    <Eye className="h-4 w-4" />
                  ) : host.connectionType === "telnet" ? (
                    <MessagesSquare className="h-4 w-4" />
                  ) : (
                    <Terminal className="h-4 w-4" />
                  )}
                  <span className="flex-1">
                    {host.connectionType === "rdp"
                      ? t("hosts.openRdp")
                      : host.connectionType === "vnc"
                        ? t("hosts.openVnc")
                        : host.connectionType === "telnet"
                          ? t("hosts.openTelnet")
                          : t("hosts.openTerminal")}
                  </span>
                </DropdownMenuItem>
              )}
              {isSSH &&
                shouldShowMetrics &&
                !(host.showServerStatsInSidebar ?? false) && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      addTab({ type: "server_stats", title, hostConfig: host });
                    }}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground-secondary hover:bg-hover"
                  >
                    <Server className="h-4 w-4" />
                    <span className="flex-1">{t("hosts.openServerStats")}</span>
                  </DropdownMenuItem>
                )}
              {isSSH &&
                host.enableFileManager &&
                !(host.showFileManagerInSidebar ?? false) && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      addTab({ type: "file_manager", title, hostConfig: host });
                    }}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground-secondary hover:bg-hover"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span className="flex-1">{t("hosts.openFileManager")}</span>
                  </DropdownMenuItem>
                )}
              {isSSH && !showTunnelShortcut && (
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation();
                    handleTunnelClick();
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground-secondary hover:bg-hover"
                >
                  <ArrowDownUp className="h-4 w-4" />
                  <span className="flex-1">{tunnelActionLabel}</span>
                </DropdownMenuItem>
              )}
              {isSSH &&
                host.enableDocker &&
                !(host.showDockerInSidebar ?? false) && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      addTab({ type: "docker", title, hostConfig: host });
                    }}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground-secondary hover:bg-hover"
                  >
                    <Container className="h-4 w-4" />
                    <span className="flex-1">{t("hosts.openDocker")}</span>
                  </DropdownMenuItem>
                )}
              {host.macAddress && (
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await wakeOnLan(host.id);
                      toast.success(t("hosts.wolSent"));
                    } catch {
                      toast.error(t("hosts.wolFailed"));
                    }
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground-secondary hover:bg-hover"
                >
                  <Power className="h-4 w-4" />
                  <span className="flex-1">{t("hosts.wakeOnLan")}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  addTab({
                    type: "ssh_manager",
                    title: t("nav.hostManager"),
                    hostConfig: host,
                    initialTab: "hosts",
                  });
                }}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-foreground-secondary hover:bg-hover"
              >
                <Pencil className="h-4 w-4" />
                <span className="flex-1">{t("common.edit")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
      {showTags && hasTags && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5">
          {tags.map((tag: string) => (
            <div
              key={tag}
              className="rounded-sm border border-edge-panel bg-surface px-1.5"
            >
              <p className="text-xs text-foreground-secondary">{tag}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
