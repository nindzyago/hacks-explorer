/**
 * Opening a glossary term from anywhere on the page (M2.4): a term in lesson text, an icon or a
 * zone on the scene, «см. также» inside a definition. The popover (GlossaryPopover.svelte)
 * registers itself here when it mounts; a caller passes the element the reader pressed, so the
 * definition stands next to it and Esc returns focus to it. The command itself
 * (`glossary.open`) carries only the id, like any command (K13).
 */

export type TermOpener = (id: string, anchor: Element | null) => void;

let opener: TermOpener | null = null;

/** The popover's own registration; returns the function that removes it. */
export function setTermOpener(next: TermOpener): () => void {
  opener = next;
  return () => {
    if (opener === next) opener = null;
  };
}

/** Opens the definition of `id` next to `anchor`; does nothing before the popover is mounted. */
export function openTerm(id: string, anchor: Element | null): void {
  opener?.(id, anchor);
}
