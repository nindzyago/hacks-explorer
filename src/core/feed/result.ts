/**
 * A text rule of the «Ход атаки» table (M1.5 verifier notes). A message payload as one unbreakable piece: runs of white space become one no-break space, so
 * «admin' --» never splits into «admin'» / «--». A payload wider than its box is still broken
 * by `overflow-wrap: anywhere` where it is shown.
 */
export function keepTogether(text: string): string {
  return text.replace(/\s+/g, ' ');
}
