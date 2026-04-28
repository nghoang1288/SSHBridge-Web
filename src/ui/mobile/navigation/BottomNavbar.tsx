import { Button } from "@/components/ui/button.tsx";
import { Menu, X, Terminal as TerminalIcon } from "lucide-react";
import { useTabs } from "@/ui/mobile/navigation/tabs/TabContext.tsx";
import { cn } from "@/lib/utils.ts";

interface MenuProps {
  onSidebarOpenClick?: () => void;
}

export function BottomNavbar({ onSidebarOpenClick }: MenuProps) {
  const { tabs, currentTab, setCurrentTab, removeTab } = useTabs();

  return (
    <div className="h-[46px] w-full items-center border-t border-white/10 bg-[#101010] p-1">
      <div className="!mb-0.5 flex gap-1.5">
        <Button
          className="h-[36px] w-[38px] flex-shrink-0 border-white/10 bg-white/5 text-white hover:bg-white/10"
          variant="outline"
          onClick={onSidebarOpenClick}
        >
          <Menu />
        </Button>
        <div className="flex-1 overflow-x-auto whitespace-nowrap thin-scrollbar">
          <div className="inline-flex gap-2">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="inline-flex rounded-md shadow-sm"
                role="group"
              >
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 rounded-r-none border border-white/10 bg-white/5 !px-2 text-white/70 hover:bg-white/10",
                    tab.id === currentTab &&
                      "!border-[#f7f4ed] !bg-[#f7f4ed] !text-[#1c1c1c]",
                  )}
                  onClick={() => setCurrentTab(tab.id)}
                >
                  <TerminalIcon className="mr-1 h-4 w-4" />
                  {tab.title}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 rounded-l-none border border-white/10 bg-white/5 !px-2 text-white/70 hover:bg-white/10"
                  onClick={() => removeTab(tab.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
