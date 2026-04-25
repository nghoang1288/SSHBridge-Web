import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils.ts";
import type { CommandAutocompleteSuggestion } from "@/lib/terminal-autocomplete.ts";

interface CommandAutocompleteProps {
  suggestions: CommandAutocompleteSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: CommandAutocompleteSuggestion) => void;
  position: { top: number; left: number };
  visible: boolean;
}

export function CommandAutocomplete({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  visible,
}: CommandAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  const footerHeight = 32;
  const maxSuggestionsHeight = 240 - footerHeight;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] bg-canvas border border-edge rounded-md shadow-lg min-w-[240px] max-w-[640px] flex flex-col"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxHeight: "240px",
      }}
    >
      <div
        className="overflow-y-auto thin-scrollbar"
        style={{ maxHeight: `${maxSuggestionsHeight}px` }}
      >
        {suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.source}-${suggestion.value}-${index}`}
            ref={index === selectedIndex ? selectedRef : null}
            className={cn(
              "px-3 py-1.5 text-sm cursor-pointer transition-colors",
              "hover:bg-hover",
              index === selectedIndex && "bg-surface text-muted-foreground",
            )}
            onClick={() => onSelect(suggestion)}
            onMouseEnter={() => {}}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono truncate">{suggestion.value}</span>
              <span className="ml-auto shrink-0 rounded border border-edge px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {suggestion.source}
              </span>
            </div>
            {(suggestion.description ||
              suggestion.label !== suggestion.value) && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {suggestion.label !== suggestion.value && (
                  <span>{suggestion.label}</span>
                )}
                {suggestion.label !== suggestion.value &&
                  suggestion.description && <span> - </span>}
                {suggestion.description && (
                  <span>{suggestion.description}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-3 py-1 text-xs text-muted-foreground border-t border-edge bg-canvas/50 shrink-0">
        Enter to complete - Tab/Up/Down to navigate - Esc to close
      </div>
    </div>
  );
}
