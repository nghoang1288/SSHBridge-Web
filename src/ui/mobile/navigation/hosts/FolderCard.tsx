import React, { useState } from "react";
import { CardTitle } from "@/components/ui/card.tsx";
import { ChevronDown, Folder } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Host } from "@/ui/mobile/navigation/hosts/Host.tsx";

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

interface FolderCardProps {
  folderName: string;
  hosts: SSHHost[];
  onHostConnect: () => void;
}

export function FolderCard({
  folderName,
  hosts,
  onHostConnect,
}: FolderCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="m-0 overflow-hidden rounded-md border border-edge-panel bg-elevated p-0">
      <div
        className={`relative bg-header px-3 py-2 ${isExpanded ? "border-b border-edge-panel" : ""}`}
      >
        <div className="flex gap-2 pr-9">
          <div className="flex-shrink-0 flex items-center">
            <Folder size={16} strokeWidth={3} />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="mb-0 break-words text-sm font-semibold leading-tight">
              {folderName}
            </CardTitle>
          </div>
        </div>
        <Button
          variant="outline"
          className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 flex-shrink-0 border-edge bg-button hover:bg-hover"
          onClick={toggleExpanded}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? "" : "rotate-180"}`}
          />
        </Button>
      </div>
      {isExpanded && (
        <div className="flex flex-col gap-y-1 p-1.5">
          {hosts.map((host, index) => (
            <React.Fragment
              key={`${folderName}-host-${host.id}-${host.name || host.ip}`}
            >
              <Host host={host} onHostConnect={onHostConnect} />

              {index < hosts.length - 1 && (
                <div className="relative -mx-1.5">
                  <Separator className="absolute inset-x-0" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
