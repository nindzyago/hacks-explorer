/**
 * Opening a glossary term from anywhere on the page (M2.4): a term in lesson text, an icon or a
 * zone on the scene, «см. также» inside a definition. The popover (GlossaryPopover.svelte)
 * registers itself here when it mounts; a caller passes the element the reader pressed, so the
 * definition stands next to it and Esc returns focus to it. The command itself
 * (`glossary.open`) carries only the id, like any command (K13).
 *
 * M2.1b: the side panel registers its own opener while it is open (a word inside the panel opens
 * its definition in the panel). The last registered opener answers; removing it gives the word
 * back to the one before.
 */

export type TermOpener = (id: string, anchor: Element | null) => void;

const openers: { readonly open: TermOpener }[] = [];

/** Registers an opener above the others; returns the function that removes this one. */
export function setTermOpener(next: TermOpener): () => void {
  const entry = { open: next };
  openers.push(entry);
  return () => {
    const at = openers.indexOf(entry);
    if (at >= 0) openers.splice(at, 1);
  };
}

/** Opens the definition of `id` next to `anchor`; does nothing before an opener is mounted. */
export function openTerm(id: string, anchor: Element | null): void {
  openers[openers.length - 1]?.open(id, anchor);
}
