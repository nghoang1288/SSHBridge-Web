import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ChevronUp, Menu, User2 } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Separator } from "@/components/ui/separator.tsx";
import { FolderCard } from "@/ui/mobile/navigation/hosts/FolderCard.tsx";
import { getSSHHosts, logoutUser } from "@/ui/main-axios.ts";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/components/theme-provider";
import { Input } from "@/components/ui/input.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";

interface SSHHost {
  id: number;
  name: string;
  ip: string;
  port: number;
  username: string;
  folder: string;
  tags: string[];
  pin: boolean;
  authType: string;
  connectionType: string;
  password?: string;
  key?: string;
  keyPassword?: string;
  keyType?: string;
  enableTerminal: boolean;
  enableTunnel: boolean;
  enableFileManager: boolean;
  defaultPath: string;
  tunnelConnections: Array<{
    sourcePort: number;
    endpointPort: number;
    endpointHost: string;
    maxRetries: number;
    retryInterval: number;
    autoStart: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface LeftSidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (type: boolean) => void;
  onHostConnect: () => void;
  disabled?: boolean;
  username?: string | null;
}

async function handleLogout() {
  try {
    await logoutUser();
    window.location.reload();
  } catch (error) {
    console.error("Logout failed:", error);
    window.location.reload();
  }
}

export function LeftSidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  onHostConnect,
  disabled,
  username,
}: LeftSidebarProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [hosts, setHosts] = useState<SSHHost[]>([]);
  const [hostsLoading] = useState(false);
  const [hostsError, setHostsError] = useState<string | null>(null);
  const prevHostsRef = React.useRef<SSHHost[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const fetchHosts = useCallback(async () => {
    try {
      const newHosts = await getSSHHosts();
      const prevHosts = prevHostsRef.current;

      if (JSON.stringify(newHosts) !== JSON.stringify(prevHosts)) {
        setHosts(newHosts);
        prevHostsRef.current = newHosts;
      }
    } catch {
      setHostsError(t("leftSidebar.failedToLoadHosts"));
    }
  }, [t]);

  useEffect(() => {
    fetchHosts();
    const interval = setInterval(fetchHosts, 300000);
    return () => clearInterval(interval);
  }, [fetchHosts]);

  useEffect(() => {
    const handleHostsChanged = () => {
      fetchHosts();
    };
    window.addEventListener(
      "ssh-hosts:changed",
      handleHostsChanged as EventListener,
    );
    return () =>
      window.removeEventListener(
        "ssh-hosts:changed",
        handleHostsChanged as EventListener,
      );
  }, [fetchHosts]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(handler);
  }, [search]);

  const filteredHosts = useMemo(() => {
    const sshOnlyHosts = hosts.filter((h) => h.connectionType === "ssh");
    if (!debouncedSearch.trim()) return sshOnlyHosts;
    const q = debouncedSearch.trim().toLowerCase();
    return sshOnlyHosts.filter((h) => {
      const searchableText = [
        h.name || "",
        h.username,
        h.ip,
        h.folder || "",
        ...(h.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(q);
    });
  }, [hosts, debouncedSearch]);

  const hostsByFolder = useMemo(() => {
    const map: Record<string, SSHHost[]> = {};
    filteredHosts.forEach((h) => {
      const folder =
        h.folder && h.folder.trim() ? h.folder : t("leftSidebar.noFolder");
      if (!map[folder]) map[folder] = [];
      map[folder].push(h);
    });
    return map;
  }, [filteredHosts, t]);

  const sortedFolders = useMemo(() => {
    const folders = Object.keys(hostsByFolder);
    folders.sort((a, b) => {
      if (a === t("leftSidebar.noFolder")) return 1;
      if (b === t("leftSidebar.noFolder")) return -1;
      return a.localeCompare(b);
    });
    return folders;
  }, [hostsByFolder, t]);

  const getSortedHosts = useCallback((arr: SSHHost[]) => {
    const pinned = arr
      .filter((h) => h.pin)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const rest = arr
      .filter((h) => !h.pin)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return [...pinned, ...rest];
  }, []);

  return (
    <div className="">
      <SidebarProvider
        open={isSidebarOpen}
        style={
          { "--sidebar-width": "min(100vw, 430px)" } as React.CSSProperties
        }
      >
        <Sidebar>
          <SidebarHeader className="p-4 pb-3">
            <SidebarGroupLabel className="h-10 text-lg font-semibold text-foreground">
              Connect
              <Button
                variant="outline"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="absolute right-4 h-8 w-8 border-edge bg-button hover:bg-hover"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SidebarGroupLabel>
            <div className="mt-2 flex items-center gap-2 text-xs text-foreground-subtle">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {filteredHosts.length} saved SSH servers
            </div>
          </SidebarHeader>
          <Separator />
          <SidebarContent>
            <SidebarGroup className="flex flex-col gap-y-3 p-4">
              <div className="rounded-md bg-field">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("placeholders.searchHostsAny")}
                  className="h-11 w-full rounded-md border !border-edge !bg-surface text-base text-foreground placeholder:text-foreground-subtle shadow-none focus-visible:border-edge-active focus-visible:ring-ring/20"
                  autoComplete="off"
                />
              </div>

              {hostsError && (
                <div className="px-1">
                  <div className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400">
                    {t("leftSidebar.failedToLoadHosts")}
                  </div>
                </div>
              )}

              {hostsLoading && (
                <div className="px-4 pb-2">
                  <div className="text-xs text-muted-foreground text-center">
                    {t("hosts.loadingHosts")}
                  </div>
                </div>
              )}

              {sortedFolders.map((folder) => (
                <FolderCard
                  key={`folder-${folder}`}
                  folderName={folder}
                  hosts={getSortedHosts(hostsByFolder[folder])}
                  onHostConnect={onHostConnect}
                />
              ))}
            </SidebarGroup>
          </SidebarContent>
          <Separator className="mt-1" />
          <SidebarFooter className="p-4">
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
                      className="rounded px-2 py-1.5 hover:bg-surface-hover hover:text-accent-foreground focus:bg-surface-hover focus:text-accent-foreground cursor-pointer focus:outline-none"
                      onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                      }
                    >
                      {theme === "dark" ? (
                        <>
                          <span>{t("theme.switchToLight")}</span>
                        </>
                      ) : (
                        <>
                          <span>{t("theme.switchToDark")}</span>
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded px-2 py-1.5 hover:bg-surface-hover hover:text-accent-foreground focus:bg-surface-hover focus:text-accent-foreground cursor-pointer focus:outline-none"
                      onClick={handleLogout}
                    >
                      <span>{t("common.logout")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
