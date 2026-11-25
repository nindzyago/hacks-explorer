/** Facts about the project that code and tests share. */
export const PROJECT = {
  name: 'Hacks Explorer',
  // The tagline is an interface string since M2.3: `app.tagline` in content/locales/<lang>/ui.md.
  /**
   * OPEN1: the two addresses of other servers the site names, as plain links a reader follows
   * (never a request: L6). structure-check allows exactly these two strings, in this file only.
   */
  repository: 'https://github.com/nindzyago/hacks-explorer',
  /** The idea of the genre (L2), named and linked on the page «About». */
  genre: { name: 'Protocol Explorer', url: 'https://protocol-explorer-alpha.vercel.app/' },
} as const;

/** How a link's address is shown as its text: without the scheme and a trailing slash. */
export function shownAddress(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
