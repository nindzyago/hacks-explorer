// Vite plugin and pure functions: the static pages of the site (M4.3). Build time only.
//
// Link previews (social networks, messengers) and some search engines do not run scripts, so a
// lesson's own title, description and card must be in the HTML the server sends. The build
// writes, next to the SPA's index.html and booting the same app:
//   - `<lang>/lesson/<ID>.html` per lesson per site language and `<lang>/about.html`: the page
//     with its `<html lang>`, `<title>`, description, canonical address, hreflang alternates,
//     Open Graph and Twitter card tags. Cloudflare serves `/ru/lesson/K1` from `ru/lesson/K1.html`
//     (assets.html_handling "auto-trailing-slash", wrangler.jsonc); any other path still gets
//     index.html (SPA fallback), so the router works as before.
//   - index.html: the site's own Open Graph tags (for links to `/`), no canonical: the same file
//     answers every unknown path.
//   - `sitemap.xml`: every page above, with its alternates in every site language; `robots.txt`
//     points to it.
// The texts come from the lessons and content/locales/<lang>/ui.md, never from code; the origin is
// SITE_ORIGIN. Cards are files in public/cards/ (scripts/make-cards.mjs); a page whose card is
// missing gets the site card, and the gate (scripts/cards.test.ts) asks for the missing one.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { lessonDescription, pageTitle } from '../src/core/meta/meta';
import { PROJECT } from '../src/core/project';
import { fill } from '../src/core/i18n/say';
import { formatAboutAddress, formatAddress } from '../src/services/router/address';
import type { DataFile, PageLesson, SiteLocalesData } from './lesson-data';
import { buildLessonData } from './lesson-data';
import { readContent } from './content-files.mjs';

/**
 * Where the site lives (K120): the absolute links of the static pages, the cards and the sitemap.
 * The one place to change it. A build constant, not site code: the site itself never names a
 * server (structure-check, no-external-urls). The draft on workers.dev is not indexed (_headers).
 */
export const SITE_ORIGIN = 'https://hacks.antipic.com';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const CARDS_FOLDER = 'cards';

/** The card of a lesson in a language, as a path in the built site. */
export function lessonCardFile(id: string, language: string): string {
  return `${CARDS_FOLDER}/${id}.${language}.png`;
}

/** The card of the site (the page «About» and the home address) in a language. */
export function siteCardFile(language: string): string {
  return `${CARDS_FOLDER}/about.${language}.png`;
}

export interface PagesInput {
  /** `https://host`, no slash at the end. */
  readonly origin: string;
  /** The built index.html. */
  readonly indexHtml: string;
  readonly locales: SiteLocalesData;
  readonly lessons: readonly PageLesson[];
  /** Card files that exist, as paths in the built site (`cards/K1.ru.png`). */
  readonly cards: ReadonlySet<string>;
}

interface Head {
  readonly lang: string;
  readonly title: string;
  readonly description: string;
  readonly type: 'website' | 'article';
  /** The name of the page for og:title, without the project. */
  readonly name: string;
  readonly url: string;
  readonly canonical: boolean;
  /** hreflang → absolute address; `x-default` included. */
  readonly alternates: readonly (readonly [string, string])[];
  readonly image: string | null;
}

/** Text for an HTML attribute or element: every character that could end it is escaped. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The tags a page adds to its head, one per line. */
export function headTags(head: Head): string {
  const tags: string[] = [];
  const meta = (attr: 'name' | 'property', key: string, value: string) =>
    tags.push(`<meta ${attr}="${key}" content="${escapeHtml(value)}" />`);
  meta('name', 'description', head.description);
  if (head.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(head.url)}" />`);
  for (const [lang, href] of head.alternates) {
    tags.push(`<link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(href)}" />`);
  }
  meta('property', 'og:type', head.type);
  meta('property', 'og:site_name', PROJECT.name);
  meta('property', 'og:title', head.name);
  meta('property', 'og:description', head.description);
  meta('property', 'og:url', head.url);
  if (head.image !== null) {
    meta('property', 'og:image', head.image);
    meta('property', 'og:image:type', 'image/png');
    meta('property', 'og:image:width', String(CARD_WIDTH));
    meta('property', 'og:image:height', String(CARD_HEIGHT));
    meta('property', 'og:image:alt', head.name);
  }
  meta('name', 'twitter:card', head.image === null ? 'summary' : 'summary_large_image');
  meta('name', 'twitter:title', head.name);
  meta('name', 'twitter:description', head.description);
  if (head.image !== null) {
    meta('name', 'twitter:image', head.image);
    meta('name', 'twitter:image:alt', head.name);
  }
  return tags.join('\n    ');
}

const HTML_TAG = /<html\b[^>]*>/i;
const TITLE = /<title>[^<]*<\/title>/i;
const DESCRIPTION = /\s*<meta\s+name="description"[^>]*>/i;

/**
 * The built index.html with the head of one page: its language, title and tags. Throws when
 * the page has no `<html>`, `<title>` or `</head>`: the build must not ship a page without them.
 */
export function withHead(indexHtml: string, head: Head): string {
  if (!HTML_TAG.test(indexHtml) || !TITLE.test(indexHtml) || !indexHtml.includes('</head>')) {
    throw new Error('index.html must have <html>, <title> and </head> (M4.3)');
  }
  return indexHtml
    .replace(HTML_TAG, `<html lang="${escapeHtml(head.lang)}">`)
    .replace(DESCRIPTION, '')
    .replace(TITLE, () => `<title>${escapeHtml(head.title)}</title>`)
    .replace('</head>', () => `  ${headTags(head)}\n  </head>`);
}

interface Page {
  readonly file: string;
  readonly path: string;
  readonly lang: string;
  /** One key for the same page in every language: `about`, `lesson:K1`. */
  readonly key: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly type: 'website' | 'article';
  readonly card: string | null;
}

function strings(locales: SiteLocalesData, lang: string): (key: string) => string {
  const own = locales.strings[lang] ?? {};
  return (key) => own[key] ?? '';
}

function pagesOf(input: PagesInput): Page[] {
  const card = (wanted: string, lang: string): string | null =>
    input.cards.has(wanted)
      ? wanted
      : input.cards.has(siteCardFile(lang))
        ? siteCardFile(lang)
        : null;
  const pages: Page[] = [];
  for (const { code: lang } of input.locales.languages) {
    const t = strings(input.locales, lang);
    const path = formatAboutAddress(lang);
    pages.push({
      file: `${path.slice(1)}.html`,
      path,
      lang,
      key: 'about',
      name: t('about.title'),
      title: pageTitle(t('about.title')),
      description: t('about.description'),
      type: 'website',
      card: card(siteCardFile(lang), lang),
    });
    const lessons = input.lessons
      .filter((l) => l.language === lang)
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const lesson of lessons) {
      const lessonPath = formatAddress({ lang, lesson: lesson.id, step: 1, defence: false });
      const say = (key: string, params?: Readonly<Record<string, string | number>>) =>
        fill(t(key), params);
      pages.push({
        file: `${lessonPath.slice(1)}.html`,
        path: lessonPath,
        lang,
        key: `lesson:${lesson.id}`,
        name: lesson.title,
        title: pageTitle(lesson.title),
        description: lessonDescription(lesson.passport, say) ?? t('app.description'),
        type: 'article',
        card: card(lessonCardFile(lesson.id, lang), lang),
      });
    }
  }
  return pages;
}

function alternatesOf(
  page: Page,
  pages: readonly Page[],
  origin: string,
  base: string,
): (readonly [string, string])[] {
  const same = pages.filter((p) => p.key === page.key);
  const out: (readonly [string, string])[] = same.map((p) => [p.lang, `${origin}${p.path}`]);
  const fallback = same.find((p) => p.lang === base) ?? same[0];
  if (fallback !== undefined) out.push(['x-default', `${origin}${fallback.path}`]);
  return out;
}

/** The sitemap of `pages`: each address with its alternates in every language it has. */
export function sitemapXml(
  entries: readonly {
    readonly url: string;
    readonly alternates: readonly (readonly [string, string])[];
  }[],
): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const entry of entries) {
    lines.push('  <url>', `    <loc>${escapeHtml(entry.url)}</loc>`);
    for (const [lang, href] of entry.alternates) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeHtml(lang)}" href="${escapeHtml(href)}"/>`,
      );
    }
    lines.push('  </url>');
  }
  lines.push('</urlset>', '');
  return lines.join('\n');
}

export function robotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

/**
 * Every static page, the new index.html, sitemap.xml and robots.txt. Throws when index.html
 * cannot take a head (see `withHead`).
 */
export function sitePages(input: PagesInput): DataFile[] {
  const origin = input.origin.replace(/\/+$/, '');
  const base = input.locales.languages[0]?.code ?? 'ru';
  const pages = pagesOf(input);
  const files: DataFile[] = [];
  const entries: { url: string; alternates: (readonly [string, string])[] }[] = [];
  for (const page of pages) {
    const url = `${origin}${page.path}`;
    const alternates = alternatesOf(page, pages, origin, base);
    files.push({
      path: page.file,
      text: withHead(input.indexHtml, {
        lang: page.lang,
        title: page.title,
        description: page.description,
        type: page.type,
        name: page.name,
        url,
        canonical: true,
        alternates,
        image: page.card === null ? null : `${origin}/${page.card}`,
      }),
    });
    entries.push({ url, alternates });
  }
  const t = strings(input.locales, base);
  const siteCard = input.cards.has(siteCardFile(base)) ? `${origin}/${siteCardFile(base)}` : null;
  files.push({
    path: 'index.html',
    text: withHead(input.indexHtml, {
      lang: base,
      title: PROJECT.name,
      description: t('app.description'),
      type: 'website',
      name: PROJECT.name,
      url: `${origin}/`,
      canonical: false,
      alternates: [],
      image: siteCard,
    }),
  });
  files.push({ path: 'sitemap.xml', text: sitemapXml(entries) });
  files.push({ path: 'robots.txt', text: robotsTxt(origin) });
  return files;
}

/** Card files in a public folder, as paths in the built site. */
export function cardsIn(publicDir: string): Set<string> {
  try {
    return new Set(
      readdirSync(join(publicDir, CARDS_FOLDER))
        .filter((name) => name.endsWith('.png'))
        .map((name) => `${CARDS_FOLDER}/${name}`),
    );
  } catch {
    return new Set();
  }
}

export interface SitePagesOptions {
  /** The folder that holds `content/`; the repository root by default. */
  readonly contentRoot?: string;
  readonly origin?: string;
}

/** Runs after Vite has written index.html into the bundle; build only. */
export function sitePagesPlugin(options: SitePagesOptions = {}): Plugin {
  let publicDir = '';
  return {
    name: 'hacks-explorer:site-pages',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_output, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset' || typeof index.source !== 'string') {
        this.error('site pages: the bundle has no index.html (M4.3)');
      }
      const data = buildLessonData(readContent(options.contentRoot));
      // The lesson data plugin has already stopped the build with these errors.
      if (!data.ok) this.error(`lesson content has errors:\n${data.errors.join('\n')}`);
      const files = sitePages({
        origin: options.origin ?? SITE_ORIGIN,
        indexHtml: index.source,
        locales: data.locales,
        lessons: data.pages,
        cards: publicDir === '' ? new Set() : cardsIn(publicDir),
      });
      for (const file of files) {
        if (file.path === 'index.html') {
          index.source = file.text;
          continue;
        }
        this.emitFile({ type: 'asset', fileName: file.path, source: file.text });
      }
    },
  };
}
