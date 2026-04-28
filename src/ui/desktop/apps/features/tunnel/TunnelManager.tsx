import React from "react";
import { useSidebar } from "@/components/ui/sidebar.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tunnel } from "@/ui/desktop/apps/features/tunnel/Tunnel.tsx";
import { useTranslation } from "react-i18next";
import { getSSHHosts } from "@/ui/main-axios.ts";
import { useTabs } from "@/ui/desktop/navigation/tabs/TabContext.tsx";
import { ArrowDownUp, Settings2 } from "lucide-react";

interface HostConfig {
  id: number;
  name: string;
  ip: string;
  username: string;
  folder?: string;
  enableFileManager?: boolean;
  tunnelConnections?: unknown[];
  [key: string]: unknown;
}

interface TunnelManagerProps {
  hostConfig?: HostConfig;
  title?: string;
  isVisible?: boolean;
  isTopbarOpen?: boolean;
  embedded?: boolean;
}

export function TunnelManager({
  hostConfig,
  title,
  isVisible = true,
  isTopbarOpen = true,
  embedded = false,
}: TunnelManagerProps): React.ReactElement {
  const { t } = useTranslation();
  const { addTab } = useTabs() as {
    addTab: (tab: Record<string, unknown>) => number;
  };
  const { state: sidebarState } = useSidebar();
  const [currentHostConfig, setCurrentHostConfig] = React.useState(hostConfig);

  React.useEffect(() => {
    if (hostConfig?.id !== currentHostConfig?.id) {
      setCurrentHostConfig(hostConfig);
    }
  }, [hostConfig?.id]);

  React.useEffect(() => {
    const fetchLatestHostConfig = async () => {
      if (hostConfig?.id) {
        try {
          const hosts = await getSSHHosts();
          const updatedHost = hosts.find((h) => h.id === hostConfig.id);
          if (updatedHost) {
            setCurrentHostConfig(updatedHost);
          }
        } catch {
          // Silently handle error
        }
      }
    };

    fetchLatestHostConfig();

    const handleHostsChanged = async () => {
      if (hostConfig?.id) {
        try {
          const hosts = await getSSHHosts();
          const updatedHost = hosts.find((h) => h.id === hostConfig.id);
          if (updatedHost) {
            setCurrentHostConfig(updatedHost);
          }
        } catch {
          // Silently handle error
        }
      }
    };

    window.addEventListener("ssh-hosts:changed", handleHostsChanged);
    return () =>
      window.removeEventListener("ssh-hosts:changed", handleHostsChanged);
  }, [hostConfig?.id]);

  const topMarginPx = isTopbarOpen ? 74 : 16;
  const leftMarginPx = sidebarState === "collapsed" ? 16 : 8;
  const bottomMarginPx = 8;

  const wrapperStyle: React.CSSProperties = embedded
    ? { opacity: isVisible ? 1 : 0, height: "100%", width: "100%" }
    : {
        opacity: isVisible ? 1 : 0,
        marginLeft: leftMarginPx,
        marginRight: 17,
        marginTop: topMarginPx,
        marginBottom: bottomMarginPx,
        height: `calc(100vh - ${topMarginPx + bottomMarginPx}px)`,
      };

  const containerClass = embedded
    ? "h-full w-full text-foreground overflow-hidden bg-transparent"
    : "bg-canvas text-foreground rounded-lg border-2 border-edge overflow-hidden";

  const openTunnelSettings = React.useCallback(() => {
    if (!currentHostConfig) return;

    addTab({
      type: "ssh_manager",
      title: "Host Manager",
      hostConfig: currentHostConfig,
      initialTab: "tunnel",
    });
  }, [addTab, currentHostConfig]);

  return (
    <div style={wrapperStyle} className={containerClass}>
      <div className="h-full w-full flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 pt-3 pb-3 gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">
                {currentHostConfig?.folder} / {title}
              </h1>
            </div>
          </div>
        </div>
        <Separator className="p-0.25 w-full" />

        <div className="flex-1 overflow-hidden min-h-0 p-1">
          {currentHostConfig?.tunnelConnections &&
          currentHostConfig.tunnelConnections.length > 0 ? (
            <div className="rounded-lg h-full overflow-hidden flex flex-col min-h-0">
              <Tunnel
                filterHostKey={
                  currentHostConfig?.name &&
                  currentHostConfig.name.trim() !== ""
                    ? currentHostConfig.name
                    : `${currentHostConfig?.username}@${currentHostConfig?.ip}`
                }
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-md rounded-lg border border-edge bg-elevated/90 p-6 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface">
                  <ArrowDownUp className="h-5 w-5 text-foreground-secondary" />
                </div>
                <p className="text-foreground-subtle text-lg">
                  {t("tunnel.noTunnelsConfigured")}
                </p>
                <p className="text-foreground-subtle text-sm mt-2">
                  {t("tunnel.configureTunnelsInHostSettings")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-9 gap-2 border-edge bg-button hover:bg-hover"
                  onClick={openTunnelSettings}
                  disabled={!currentHostConfig}
                >
                  <Settings2 className="h-4 w-4" />
                  Configure tunnels
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
