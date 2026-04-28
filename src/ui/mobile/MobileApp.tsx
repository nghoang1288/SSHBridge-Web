import React, {
  useState,
  useEffect,
  Component,
  type FC,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Terminal } from "@/ui/mobile/apps/terminal/Terminal.tsx";
import { TerminalKeyboard } from "@/ui/mobile/apps/terminal/TerminalKeyboard.tsx";
import { BottomNavbar } from "@/ui/mobile/navigation/BottomNavbar.tsx";
import { LeftSidebar } from "@/ui/mobile/navigation/LeftSidebar.tsx";
import {
  TabProvider,
  useTabs,
} from "@/ui/mobile/navigation/tabs/TabContext.tsx";
import { getUserInfo } from "@/ui/main-axios.ts";
import { Auth } from "@/ui/mobile/authentication/Auth.tsx";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/sonner.tsx";

function isReactNativeWebView(): boolean {
  return typeof window !== "undefined" && !!(window as any).ReactNativeWebView;
}

const AppContent: FC = () => {
  const { t } = useTranslation();
  const { tabs, currentTab, getTab } = useTabs();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [ready, setReady] = React.useState(true);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      setAuthLoading(true);
      getUserInfo()
        .then((meRes) => {
          if (typeof meRes === "string" || !meRes.username) {
            setIsAuthenticated(false);
            setIsAdmin(false);
            setUsername(null);
            localStorage.removeItem("jwt");
          } else {
            setIsAuthenticated(true);
            setIsAdmin(!!meRes.is_admin);
            setUsername(meRes.username || null);
          }
        })
        .catch((err) => {
          setIsAuthenticated(false);
          setIsAdmin(false);
          setUsername(null);

          localStorage.removeItem("jwt");

          const errorCode = err?.response?.data?.code;
          if (errorCode === "SESSION_EXPIRED") {
            console.warn(t("errors.sessionExpired"));
          }
        })
        .finally(() => setAuthLoading(false));
    };

    checkAuth();

    const handleStorageChange = () => checkAuth();
    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fitCurrentTerminal();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleAuthSuccess = (authData: {
    isAdmin: boolean;
    username: string | null;
    userId: string | null;
  }) => {
    setIsAuthenticated(true);
    setIsAdmin(authData.isAdmin);
    setUsername(authData.username);
  };

  const fitCurrentTerminal = () => {
    const tab = getTab(currentTab as number);
    if (tab && tab.terminalRef?.current?.fit) {
      tab.terminalRef.current.fit();
    }
  };

  React.useEffect(() => {
    if (tabs.length > 0) {
      setReady(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fitCurrentTerminal();
          setReady(true);
        });
      });
    }
  }, [currentTab]);

  const closeSidebar = () => setIsSidebarOpen(false);

  const handleKeyboardLayoutChange = () => {
    fitCurrentTerminal();
  };

  function handleKeyboardInput(input: string) {
    const currentTerminalTab = getTab(currentTab as number);
    if (
      currentTerminalTab &&
      currentTerminalTab.terminalRef?.current?.sendInput
    ) {
      currentTerminalTab.terminalRef.current.sendInput(input);
    }
  }

  if (authLoading) {
    return (
      <div className="sshbridge-mobile-auth flex h-screen w-screen items-center justify-center p-5">
        <div className="sshbridge-loader-card w-full max-w-xs rounded-xl p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">
              SB
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                SSHBridge
              </div>
              <div className="text-xs text-foreground-subtle">
                Mobile terminal
              </div>
            </div>
          </div>
          <div className="sshbridge-loader-bar" />
          <p className="mt-4 text-sm text-foreground-secondary">
            {t("common.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || isReactNativeWebView()) {
    return (
      <div className="sshbridge-mobile-auth flex h-screen w-screen items-center justify-center p-4">
        <Auth
          setLoggedIn={setIsAuthenticated}
          setIsAdmin={setIsAdmin}
          setUsername={setUsername}
          setUserId={() => {}}
          loggedIn={isAuthenticated}
          authLoading={authLoading}
          dbError={null}
          setDbError={() => {}}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-x-hidden overflow-y-hidden bg-[#101010]">
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 bg-deepest ${tab.id === currentTab ? "visible" : "invisible"} ${ready ? "opacity-100" : "opacity-0"}`}
          >
            <Terminal
              ref={tab.terminalRef}
              hostConfig={tab.hostConfig}
              isVisible={tab.id === currentTab}
            />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="sshbridge-mobile-surface flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-foreground">
            <div className="rounded-lg border border-edge-panel bg-elevated/90 px-4 py-4">
              <h1 className="text-lg font-semibold">
                {t("mobile.selectHostToStart")}
              </h1>
              <p className="mt-1 max-w-xs text-sm text-foreground-secondary">
                {t("mobile.limitedSupportMessage")}
              </p>
            </div>
            <button
              className="sshbridge-primary-button mt-2 rounded-md px-6 py-3 font-semibold transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              Open server list
            </button>
          </div>
        )}
      </div>
      {currentTab && (
        <div className="z-10">
          <TerminalKeyboard
            onSendInput={handleKeyboardInput}
            onLayoutChange={handleKeyboardLayoutChange}
          />
        </div>
      )}
      <BottomNavbar onSidebarOpenClick={() => setIsSidebarOpen(true)} />

      {isSidebarOpen && (
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm z-10"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="absolute top-0 left-0 h-full z-20 pointer-events-none">
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="pointer-events-auto"
        >
          <LeftSidebar
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            onHostConnect={closeSidebar}
            disabled={!isAuthenticated || authLoading}
            username={username}
          />
        </div>
      </div>
      <Toaster
        position="bottom-center"
        richColors={false}
        closeButton
        duration={5000}
        offset={20}
      />
    </div>
  );
};

class TabErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorCount: number }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    if (error.message?.includes("useTabs must be used within a TabProvider")) {
      return { hasError: true };
    }
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (error.message?.includes("useTabs must be used within a TabProvider")) {
      console.warn(
        "TabProvider mounting race condition detected, recovering...",
      );
      this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));
      setTimeout(() => {
        this.setState({ hasError: false });
      }, 0);
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export const MobileApp: FC = () => {
  return (
    <TabProvider>
      <TabErrorBoundary>
        <AppContent />
      </TabErrorBoundary>
    </TabProvider>
  );
};
