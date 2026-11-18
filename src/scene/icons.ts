/**
 * Participant icons (K42, design M1.2 E5): the files in content/icons, cut from the prototype
 * sheets by scripts/cut-icons.sh. The bundler copies each file into the build under a hashed
 * name and gives its same-origin URL here; nothing is fetched until the scene draws an icon.
 * The lesson names an icon by file name without the extension (`icon:browser`, or the
 * participant id). A name with no file gets `null`: the scene draws a neutral placeholder.
 */
const files = import.meta.glob<string>('../../content/icons/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

const ICONS: ReadonlyMap<string, string> = new Map(
  Object.entries(files).flatMap(([path, url]) => {
    const name = /\/([a-z0-9-]+)\.webp$/.exec(path)?.[1];
    return name === undefined ? [] : [[name, url] as const];
  }),
);

/** The URL of the icon `name`, or `null` when there is no such icon. */
export function iconUrl(name: unknown): string | null {
  return typeof name === 'string' ? (ICONS.get(name) ?? null) : null;
}

/** Names of all icons, sorted: for tests and for the lesson checker later. */
export function iconNames(): readonly string[] {
  return [...ICONS.keys()].sort();
}
