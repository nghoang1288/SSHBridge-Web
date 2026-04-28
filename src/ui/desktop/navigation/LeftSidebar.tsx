import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronUp,
  CircleDot,
  HardDrive,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Server,
  Terminal,
  User2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar.tsx";
import { cn } from "@/lib/utils.ts";
import { useServerStatus } from "@/ui/contexts/ServerStatusContext";
import { FolderCard } from "@/ui/desktop/navigation/hosts/FolderCard.tsx";
import { useTabs } from "@/ui/desktop/navigation/tabs/TabContext.tsx";
import {
  getGuacamoleDpi,
  getGuacamoleTokenFromHost,
  getSSHFolders,
  getSSHHosts,
  isElectron,
  logActivity,
  logoutUser,
} from "@/ui/main-axios.ts";
import type { SSHFolder, SSHHost } from "@/types/index.ts";

interface SidebarProps {
  disabled?: boolean;
  isAdmin?: boolean;
  username?: string | null;
  children?: React.ReactNode;
  onLogout?: () => void;
}

const COMPACT_WIDTH = 76;
const EXPANDED_WIDTH = 320;

function getMaxSidebarWidth() {
  return Math.min(420, Math.max(EXPANDED_WIDTH, Math.floor(window.innerWidth * 0.34)));
}

function clampSidebarWidth(value: number) {
  return Math.min(getMaxSidebarWidth(), Math.max(COMPACT_WIDTH, value));
}

async function handleLogout() {
  try {
    await logoutUser();

    if (isElectron()) {
      localStorage.removeItem("jwt");
    }

    window.location.reload();
  } catch (error) {
    console.error("Logout failed:", error);
    window.location.reload();
  }
}

function getHostTitle(host: SSHHost) {
  return host.name?.trim() || `${host.username}@${host.ip}:${host.port}`;
}

function getHostEndpoint(host: SSHHost) {
  return `${host.username}@${host.ip}:${host.port}`;
}

export function LeftSidebar({
  disabled,
  isAdmin,
  username,
  children,
  onLogout,
}: SidebarProps): React.ReactElement {
  const { t } = useTranslation();
  const { getStatus } = useServerStatus();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem("leftSidebarOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("leftSidebarWidthV2");
    if (!saved) return COMPACT_WIDTH;
    const parsed = parseInt(saved, 10);
    if (!Number.isFinite(parsed)) return COMPACT_WIDTH;
    return clampSidebarWidth(parsed);
  });
  const isCompact = sidebarWidth <= 120;

  const {
    tabs: tabList,
    currentTab,
    addTab,
    setCurrentTab,
    allSplitScreenTab,
  } = useTabs() as {
    tabs: Array<{ id: number; type: string; [key: string]: unknown }>;
    currentTab: number;
    addTab: (tab: { type: string; [key: string]: unknown }) => number;
    setCurrentTab: (id: number) => void;
    allSplitScreenTab: number[];
  };

  const [hosts, setHosts] = useState<SSHHost[]>([]);
  const [hostsLoading] = useState(false);
  const [hostsError, setHostsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [folderMetadata, setFolderMetadata] = useState<Map<string, SSHFolder>>(
    new Map(),
  );
  const prevHostsRef = useRef<SSHHost[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startWidthRef = useRef<number>(sidebarWidth);

  const isSplitScreenActive =
    Array.isArray(allSplitScreenTab) && allSplitScreenTab.length > 0;
  const currentTabObj = tabList.find((tab) => tab.id === currentTab);

  const openHomeTab = useCallback(() => {
    if (isSplitScreenActive) return;
    const homeTab = tabList.find((tab) => tab.type === "home");
    if (homeTab) {
      setCurrentTab(homeTab.id);
      return;
    }
    const id = addTab({ type: "home", title: t("nav.home") });
    setCurrentTab(id);
  }, [addTab, isSplitScreenActive, setCurrentTab, t, tabList]);

  const openSshManagerTab = useCallback(() => {
    if (isSplitScreenActive) return;
    const existing = tabList.find((tab) => tab.type === "ssh_manager");
    if (existing) {
      setCurrentTab(existing.id);
      return;
    }
    const id = addTab({ type: "ssh_manager", title: t("nav.hostManager") });
    setCurrentTab(id);
  }, [addTab, isSplitScreenActive, setCurrentTab, t, tabList]);

  const openAdminTab = useCallback(() => {
    if (isSplitScreenActive) return;
    const existing = tabList.find((tab) => tab.type === "admin");
    if (existing) {
      setCurrentTab(existing.id);
      return;
    }
    const id = addTab({ type: "admin" });
    setCurrentTab(id);
  }, [addTab, isSplitScreenActive, setCurrentTab, tabList]);

  const openUserProfileTab = useCallback(() => {
    if (isSplitScreenActive) return;
    const existing = tabList.find((tab) => tab.type === "user_profile");
    if (existing) {
      setCurrentTab(existing.id);
      return;
    }
    const id = addTab({ type: "user_profile" });
    setCurrentTab(id);
  }, [addTab, isSplitScreenActive, setCurrentTab, tabList]);

  const openHost = useCallback(
    async (host: SSHHost) => {
      const title = getHostTitle(host);
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
    },
    [addTab],
  );

  const fetchFolderMetadata = useCallback(async () => {
    try {
      const folders = await getSSHFolders();
      setFolderMetadata(new Map(folders.map((folder) => [folder.name, folder])));
    } catch (error) {
      console.error("Failed to fetch folder metadata:", error);
    }
  }, []);

  const fetchHosts = useCallback(async () => {
    try {
      const newHosts = await getSSHHosts();
      if (JSON.stringify(newHosts) !== JSON.stringify(prevHostsRef.current)) {
        setHosts(newHosts);
        prevHostsRef.current = newHosts;
      }
      setHostsError(null);
    } catch {
      setHostsError(t("leftSidebar.failedToLoadHosts"));
    }
  }, [t]);

  const fetchHostsRef = useRef(fetchHosts);
  const fetchFolderMetadataRef = useRef(fetchFolderMetadata);

  useEffect(() => {
    fetchHostsRef.current = fetchHosts;
    fetchFolderMetadataRef.current = fetchFolderMetadata;
  });

  useEffect(() => {
    fetchHostsRef.current();
    fetchFolderMetadataRef.current();
    const interval = setInterval(() => {
      fetchHostsRef.current();
      fetchFolderMetadataRef.current();
    }, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleHostsChanged = () => {
      fetchHostsRef.current();
      fetchFolderMetadataRef.current();
    };
    const handleCredentialsChanged = () => fetchHostsRef.current();
    const handleFoldersChanged = () => fetchFolderMetadataRef.current();

    window.addEventListener("ssh-hosts:changed", handleHostsChanged);
    window.addEventListener("credentials:changed", handleCredentialsChanged);
    window.addEventListener("folders:changed", handleFoldersChanged);

    return () => {
      window.removeEventListener("ssh-hosts:changed", handleHostsChanged);
      window.removeEventListener("credentials:changed", handleCredentialsChanged);
      window.removeEventListener("folders:changed", handleFoldersChanged);
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("leftSidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("leftSidebarWidthV2", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const handleResize = () => {
      setSidebarWidth((width) => clampSidebarWidth(width));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (isCompact) return;
    event.preventDefault();
    setIsResizing(true);
    startXRef.current = event.clientX;
    startWidthRef.current = sidebarWidth;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (startXRef.current == null) return;
      const dx = event.clientX - startXRef.current;
      setSidebarWidth(clampSidebarWidth(Math.round(startWidthRef.current + dx)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      startXRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const filteredHosts = useMemo(() => {
    if (!debouncedSearch.trim()) return hosts;
    const searchQuery = debouncedSearch.trim().toLowerCase();

    return hosts.filter((host) => {
      const fieldMatches: Record<string, string> = {};
      let remainingQuery = searchQuery;
      const fieldPattern = /(\w+):([^\s]+)/g;
      let match;

      while ((match = fieldPattern.exec(searchQuery)) !== null) {
        const [fullMatch, field, value] = match;
        fieldMatches[field] = value;
        remainingQuery = remainingQuery.replace(fullMatch, "").trim();
      }

      for (const [field, value] of Object.entries(fieldMatches)) {
        switch (field) {
          case "tag":
          case "tags": {
            const tags = Array.isArray(host.tags) ? host.tags : [];
            if (!tags.some((tag) => tag.toLowerCase().includes(value))) {
              return false;
            }
            break;
          }
          case "name":
            if (!(host.name || "").toLowerCase().includes(value)) return false;
            break;
          case "user":
          case "username":
            if (!host.username.toLowerCase().includes(value)) return false;
            break;
          case "ip":
          case "host":
            if (!host.ip.toLowerCase().includes(value)) return false;
            break;
          case "port":
            if (!String(host.port).includes(value)) return false;
            break;
          case "folder":
            if (!(host.folder || "").toLowerCase().includes(value)) return false;
            break;
          case "auth":
          case "authtype":
            if (!host.authType.toLowerCase().includes(value)) return false;
            break;
          case "path":
            if (!(host.defaultPath || "").toLowerCase().includes(value)) {
              return false;
            }
            break;
        }
      }

      if (!remainingQuery) return true;
      const searchableText = [
        host.name || "",
        host.username,
        host.ip,
        host.folder || "",
        ...(host.tags || []),
        host.authType,
        host.defaultPath || "",
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(remainingQuery);
    });
  }, [hosts, debouncedSearch]);

  const hostsByFolder = useMemo(() => {
    const map: Record<string, SSHHost[]> = {};
    filteredHosts.forEach((host) => {
      const folder =
        host.folder && host.folder.trim()
          ? host.folder
          : t("leftSidebar.noFolder");
      if (!map[folder]) map[folder] = [];
      map[folder].push(host);
    });
    return map;
  }, [filteredHosts, t]);

  const sortedFolders = useMemo(() => {
    const folders = Object.keys(hostsByFolder);
    folders.sort((a, b) => {
      if (a === t("leftSidebar.noFolder")) return -1;
      if (b === t("leftSidebar.noFolder")) return 1;
      return a.localeCompare(b);
    });
    return folders;
  }, [hostsByFolder, t]);

  const getSortedHosts = useCallback((arr: SSHHost[]) => {
    const pinned = arr
      .filter((host) => host.pin)
      .sort((a, b) => getHostTitle(a).localeCompare(getHostTitle(b)));
    const rest = arr
      .filter((host) => !host.pin)
      .sort((a, b) => getHostTitle(a).localeCompare(getHostTitle(b)));
    return [...pinned, ...rest];
  }, []);

  const railHosts = useMemo(() => {
    return getSortedHosts(hosts)
      .sort((a, b) => {
        const aStatus = getStatus(a.id);
        const bStatus = getStatus(b.id);
        if (aStatus !== bStatus) return aStatus === "online" ? -1 : 1;
        return 0;
      })
      .slice(0, 5);
  }, [getSortedHosts, getStatus, hosts]);

  const statusClass = (hostId: number) => {
    const status = getStatus(hostId);
    if (status === "online") return "bg-emerald-400";
    if (status === "offline") return "bg-rose-400";
    return "bg-amber-300";
  };

  const renderRailButton = ({
    label,
    icon,
    active,
    onClick,
    disabled: railDisabled,
  }: {
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={railDisabled}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-md border text-foreground-secondary transition-colors",
        active
          ? "border-edge-active bg-active text-foreground"
          : "border-transparent bg-transparent hover:border-edge hover:bg-surface",
        railDisabled && "cursor-not-allowed opacity-45",
      )}
    >
      {icon}
    </button>
  );

  const compactRail = (
    <>
      <SidebarHeader className="flex items-center gap-2 p-2">
        <button
          type="button"
          title={t("nav.home")}
          aria-label={t("nav.home")}
          onClick={openHomeTab}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-edge-active bg-active font-mono text-sm font-bold text-foreground"
        >
          SB
        </button>
        {renderRailButton({
          label: "Expand sidebar",
          icon: <PanelLeftOpen className="h-5 w-5" />,
          onClick: () => setSidebarWidth(EXPANDED_WIDTH),
        })}
      </SidebarHeader>
      <Separator />
      <SidebarContent className="items-center px-2 py-3">
        <div className="flex flex-col items-center gap-2">
          {renderRailButton({
            label: t("nav.home"),
            icon: <Home className="h-5 w-5" />,
            active: currentTabObj?.type === "home",
            onClick: openHomeTab,
            disabled: isSplitScreenActive,
          })}
          {renderRailButton({
            label: t("nav.hostManager"),
            icon: <HardDrive className="h-5 w-5" />,
            active: currentTabObj?.type === "ssh_manager",
            onClick: openSshManagerTab,
            disabled: isSplitScreenActive,
          })}
        </div>

        <div className="my-3 h-px w-9 bg-edge-panel" />

        <div className="flex flex-col items-center gap-2">
          {railHosts.map((host) => (
            <button
              key={`rail-host-${host.id}`}
              type="button"
              title={`${getHostTitle(host)}\n${getHostEndpoint(host)}`}
              aria-label={getHostTitle(host)}
              onClick={() => openHost(host)}
              className="relative flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-foreground-secondary transition-colors hover:border-edge-hover hover:bg-surface-hover hover:text-foreground"
            >
              <Terminal className="h-5 w-5" />
              <span
                className={cn(
                  "absolute right-2 top-2 h-2 w-2 rounded-full",
                  statusClass(host.id),
                )}
              />
            </button>
          ))}
        </div>
      </SidebarContent>
      <Separator />
      <SidebarFooter className="items-center p-2">
        {renderRailButton({
          label: username || t("profile.title"),
          icon: <User2 className="h-5 w-5" />,
          onClick: openUserProfileTab,
          disabled,
        })}
      </SidebarFooter>
    </>
  );

  const expandedPanel = (
    <>
      <SidebarHeader className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Servers</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground-subtle">
              <CircleDot className="h-3 w-3 text-emerald-300" />
              {hosts.length} saved
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="outline"
              onClick={() => setSidebarWidth(COMPACT_WIDTH)}
              className="h-8 w-8 border-edge bg-button p-0 hover:bg-hover"
              title="Compact rail"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-8 w-8 border-edge bg-button p-0 hover:bg-hover"
              title={t("common.toggleSidebar")}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <div className="grid grid-cols-2 gap-2 p-3">
          <Button
            variant="outline"
            className="h-9 justify-start gap-2 border-edge bg-button hover:bg-hover"
            onClick={openHomeTab}
            disabled={isSplitScreenActive}
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
          <Button
            variant="outline"
            className="h-9 justify-start gap-2 border-edge bg-button hover:bg-hover"
            onClick={openSshManagerTab}
            disabled={isSplitScreenActive}
          >
            <HardDrive className="h-4 w-4" />
            Manage
          </Button>
        </div>
        <Separator />
        <div className="flex flex-col gap-y-2 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("placeholders.searchHostsAny")}
              className="h-9 w-full rounded-md border !border-edge !bg-surface pl-9 text-sm text-foreground placeholder:text-foreground-subtle shadow-none focus-visible:border-edge-active focus-visible:ring-ring/20"
              autoComplete="off"
            />
          </div>

          {hostsError && (
            <div className="rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {hostsError}
            </div>
          )}

          {hostsLoading && (
            <div className="px-4 pb-2">
              <div className="text-center text-xs text-muted-foreground">
                {t("hosts.loadingHosts")}
              </div>
            </div>
          )}

          {sortedFolders.map((folder, index) => {
            const metadata = folderMetadata.get(folder);
            return (
              <FolderCard
                key={`folder-${folder}`}
                folderName={folder}
                hosts={getSortedHosts(hostsByFolder[folder])}
                isFirst={index === 0}
                isLast={index === sortedFolders.length - 1}
                folderColor={metadata?.color}
                folderIcon={metadata?.icon}
              />
            );
          })}
        </div>
      </SidebarContent>
      <Separator className="my-1" />
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className="data-[state=open]:opacity-90 w-full"
                  disabled={disabled}
                >
                  <User2 /> {username ? username : t("common.logout")}
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={6}
                className="min-w-[var(--radix-popper-anchor-width)] rounded-md border border-edge bg-popover p-1 text-popover-foreground shadow-2xl"
              >
                <DropdownMenuItem
                  className="cursor-pointer rounded px-2 py-1.5 hover:bg-surface-hover hover:text-accent-foreground focus:bg-surface-hover focus:text-accent-foreground focus:outline-none"
                  onClick={openUserProfileTab}
                >
                  <User2 className="mr-2 inline h-4 w-4" />
                  <span>{t("profile.title")}</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem
                    className="cursor-pointer rounded px-2 py-1.5 hover:bg-surface-hover hover:text-accent-foreground focus:bg-surface-hover focus:text-accent-foreground focus:outline-none"
                    onClick={openAdminTab}
                  >
                    <Server className="mr-2 inline h-4 w-4" />
                    <span>{t("admin.title")}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="cursor-pointer rounded px-2 py-1.5 hover:bg-surface-hover hover:text-accent-foreground focus:bg-surface-hover focus:text-accent-foreground focus:outline-none"
                  onClick={onLogout || handleLogout}
                >
                  <LogOut className="mr-2 inline h-4 w-4" />
                  <span>{t("common.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );

  return (
    <div className="h-screen w-screen overflow-hidden">
      <SidebarProvider
        open={isSidebarOpen}
        style={
          { "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
        }
      >
        <div className="flex h-screen w-screen overflow-hidden">
          <Sidebar variant="floating">
            {isCompact ? compactRail : expandedPanel}
            {!isCompact && isSidebarOpen && (
              <div
                className="absolute top-0 z-[60] h-full cursor-col-resize"
                onMouseDown={handleMouseDown}
                style={{
                  right: "-4px",
                  width: "8px",
                  backgroundColor: isResizing
                    ? "var(--bg-interact)"
                    : "transparent",
                }}
                onMouseEnter={(event) => {
                  if (!isResizing) {
                    event.currentTarget.style.backgroundColor =
                      "var(--border-hover)";
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isResizing) {
                    event.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
                title={t("common.dragToResizeSidebar")}
              />
            )}
          </Sidebar>

          <SidebarInset>{children}</SidebarInset>
        </div>
      </SidebarProvider>

      {!isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-0 top-0 flex h-full w-[10px] cursor-pointer items-center justify-center rounded-br-md rounded-tr-md"
          style={{
            zIndex: 9999,
            backgroundColor: "var(--bg-base)",
            border: "1px solid var(--border-base)",
            borderLeft: "none",
          }}
        >
          <ChevronRight size={10} />
        </div>
      )}
    </div>
  );
}
