import React, { useEffect, useState, useMemo } from "react";
import { Status, StatusIndicator } from "@/components/ui/shadcn-io/status";
import { Button } from "@/components/ui/button.tsx";
import { ButtonGroup } from "@/components/ui/button-group.tsx";
import { Terminal } from "lucide-react";
import { getServerStatusById } from "@/ui/main-axios.ts";
import { useTabs } from "@/ui/mobile/navigation/tabs/TabContext.tsx";
import type { HostProps } from "../../../../types/index.js";
import { DEFAULT_STATS_CONFIG } from "@/types/stats-widgets";

export function Host({ host, onHostConnect }: HostProps): React.ReactElement {
  const { addTab } = useTabs();
  const [serverStatus, setServerStatus] = useState<
    "online" | "offline" | "degraded"
  >("degraded");
  const tags = Array.isArray(host.tags) ? host.tags : [];
  const hasTags = tags.length > 0;

  const title = host.name?.trim()
    ? host.name
    : `${host.username}@${host.ip}:${host.port}`;
  const endpoint = `${host.username}@${host.ip}:${host.port}`;

  const statsConfig = useMemo(() => {
    try {
      return host.statsConfig
        ? JSON.parse(host.statsConfig)
        : DEFAULT_STATS_CONFIG;
    } catch {
      return DEFAULT_STATS_CONFIG;
    }
  }, [host.statsConfig]);

  const shouldShowStatus = statsConfig.statusCheckEnabled !== false;

  useEffect(() => {
    if (!shouldShowStatus) {
      setServerStatus("offline");
      return;
    }

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await getServerStatusById(host.id);
        if (!cancelled) {
          setServerStatus(res?.status === "online" ? "online" : "offline");
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const err = error as { response?: { status?: number } };
          if (err?.response?.status === 503) {
            setServerStatus("offline");
          } else if (err?.response?.status === 504) {
            setServerStatus("degraded");
          } else if (err?.response?.status === 404) {
            setServerStatus("offline");
          } else {
            setServerStatus("offline");
          }
        }
      }
    };

    fetchStatus();

    const intervalId = window.setInterval(fetchStatus, 10000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [host.id, shouldShowStatus]);

  const handleTerminalClick = () => {
    addTab({ type: "terminal", title, hostConfig: host });
    onHostConnect();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="rounded-md px-2 py-2 outline-none transition-colors active:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
      onClick={handleTerminalClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleTerminalClick();
        }
      }}
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
          {host.enableTerminal && (
            <Button
              variant="outline"
              className="h-9 w-[54px] border border-edge bg-button !px-2 hover:bg-hover"
              onClick={(event) => {
                event.stopPropagation();
                handleTerminalClick();
              }}
            >
              <Terminal />
            </Button>
          )}
        </ButtonGroup>
      </div>
      {hasTags && (
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
