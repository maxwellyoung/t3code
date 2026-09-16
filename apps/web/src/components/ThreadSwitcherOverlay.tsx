import { createPortal } from "react-dom";

import { cn } from "../lib/utils";

export interface ThreadSwitcherEntry {
  readonly threadKey: string;
  readonly title: string;
  readonly subtitle: string | null;
}

/**
 * The list shown while a traversal chord is held. Keyboard-only and inert to the
 * pointer: it appears and disappears with the modifier, so a click target here
 * would be gone before it could be hit.
 */
export function ThreadSwitcherOverlay({
  entries,
  index,
}: {
  entries: readonly ThreadSwitcherEntry[];
  index: number;
}) {
  if (entries.length === 0) return null;

  // Portalled to the body: the sidebar it is rendered from is a positioned,
  // transitioning panel, and a fixed child of one is positioned against it.
  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-100 flex items-center justify-center p-4"
      data-thread-switcher=""
    >
      <div
        aria-label="Recent threads"
        className="dropdown-glass w-[min(26rem,100%)] rounded-xl p-1.5 shadow-[0_24px_60px_-24px_rgb(0_0_0/60%)]"
        role="listbox"
      >
        {entries.map((entry, entryIndex) => (
          <div
            aria-selected={entryIndex === index}
            className={cn(
              "flex min-w-0 items-baseline gap-2 rounded-sm px-2 py-1.5",
              entryIndex === index && "bg-accent text-accent-foreground",
            )}
            key={entry.threadKey}
            role="option"
          >
            <span className="min-w-0 flex-1 truncate text-sm">{entry.title}</span>
            {entry.subtitle === null ? null : (
              <span className="shrink-0 truncate text-muted-foreground text-xs">
                {entry.subtitle}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
