/**
 * Left-edge hover peek: while the sidebar is collapsed, resting the pointer on
 * the window's left edge floats it back over the content without reopening it.
 * The layout gap stays zero throughout, so the main pane never reflows.
 */

/** Width of the invisible strip that arms the peek, in pixels. */
export const SIDEBAR_HOVER_PEEK_EDGE_WIDTH_PX = 8;

/** Pointer dwell required on the edge before peeking, so passing sweeps miss. */
export const SIDEBAR_HOVER_PEEK_OPEN_DELAY_MS = 110;

/** Grace after leaving the panel, so clipping its corner does not dismiss it. */
export const SIDEBAR_HOVER_PEEK_CLOSE_DELAY_MS = 180;

/** Slack to the right of the panel that still counts as "on" it. */
export const SIDEBAR_HOVER_PEEK_REGION_SLACK_PX = 12;

/**
 * Selector for an open menu a peeked row can own. Menus portal out of the panel,
 * so the pointer sitting on one reads as "outside"; collapsing the panel then
 * pulls the anchor out from under an open menu.
 *
 * Menu popups only. A broader `[role="dialog"]` also matches notification
 * toasts and every unrelated modal, any one of which would pin the panel open
 * for as long as it is on screen.
 */
export const SIDEBAR_HOVER_PEEK_HOLD_OPEN_SELECTOR =
  '[data-slot="menu-popup"],[data-slot="menu-sub-content"]';

/**
 * Peek is a mouse affordance. Touch reports a tap as a hover and would open the
 * panel on every tap near the edge; pen behaves the same way.
 */
export function isHoverPeekPointerType(pointerType: string): boolean {
  return pointerType === "mouse" || pointerType === "";
}

export function shouldClosePeekForPointer(input: {
  pointerX: number;
  panelWidth: number;
  holdOpen: boolean;
}): boolean {
  if (input.holdOpen) return false;
  return input.pointerX > input.panelWidth + SIDEBAR_HOVER_PEEK_REGION_SLACK_PX;
}
