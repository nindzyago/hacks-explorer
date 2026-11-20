// M4.3, oracle level D (scenario S4: a link opens the same place; its preview names it): every
// lesson and the page «About» get a static page with their own head; the sitemap lists them all.
import { describe, expect, it } from 'vitest';
import { lessonDescription, pageTitle } from '../src/core/meta/meta';
import { fill } from '../src/core/i18n/say';
import { parseAddress } from '../src/services/router/address';
import { readContent } from './content-files.mjs';
import { buildLessonData } from './lesson-data';
import type { PageLesson, SiteLocalesData } from './lesson-data';
import {
  SITE_ORIGIN,
  escapeHtml,
  lessonCardFile,
  robotsTxt,
  siteCardFile,
  sitePages,
  withHead,
} from './site-pages';

const ORIGIN = 'https://site.example';
const INDEX = [
  '<!doctype html>',
  '<html lang="ru">',
  '  <head>',
  '    <meta charset="utf-8" />',
  '    <meta',
  '      name="description"',
  '      content="default"',
  '    />',
  '    <title>Hacks Explorer</title>',
  '    <script type="module" crossorigin src="/assets/index-x.js"></script>',
  '  </head>',
  '  <body><div id="app"></div></body>',
  '</html>',
].join('\n');

const real = buildLessonData(readContent());
if (!real.ok) throw new Error(real.errors.join('\n'));
const { locales, pages: lessons } = real;
const languages = locales.languages.map((l) => l.code);
const allCards = new Set([
  ...lessons.map((l) => lessonCardFile(l.id, l.language)),
  ...languages.map(siteCardFile),
]);

function files(cards: ReadonlySet<string> = allCards) {
  return sitePages({ origin: ORIGIN, indexHtml: INDEX, locales, lessons, cards });
}
function text(path: string, cards?: ReadonlySet<string>): string {
  const found = files(cards).find((f) => f.path === path);
  if (found === undefined) throw new Error(`no ${path}`);
  return found.text;
}
function attr(html: string, selector: RegExp): string | null {
  const match = selector.exec(html);
  return match?.[1] ?? null;
}
const metaContent = (html: string, key: string) =>
  attr(html, new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)" />`));
const unescape = (s: string | null) =>
  s
    ?.replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&') ?? null;

function say(lang: string) {
  const own = locales.strings[lang] ?? {};
  return (key: string, params?: Readonly<Record<string, string | number>>) =>
    fill(own[key] ?? '', params);
}

describe('static pages on the real content', () => {
  it('has the site languages and 10 lessons in each', () => {
    expect(languages.length).toBeGreaterThanOrEqual(2);
    for (const lang of languages) {
      expect(lessons.filter((l) => l.language === lang).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('writes a page per lesson per language and an «About» per language, plus index, sitemap, robots', () => {
    const paths = files().map((f) => f.path);
    const want = [
      ...languages.map((lang) => `${lang}/about.html`),
      ...lessons.map((l) => `${l.language}/lesson/${l.id}.html`),
      'index.html',
      'sitemap.xml',
      'robots.txt',
    ];
    expect([...paths].sort()).toEqual([...want].sort());
  });

  it.each(lessons.map((l) => [`${l.language}/${l.id}`, l] as const))(
    '%s: its own language, title, description, canonical, alternates and card',
    (_name, lesson: PageLesson) => {
      const html = text(`${lesson.language}/lesson/${lesson.id}.html`);
      const url = `${ORIGIN}/${lesson.language}/lesson/${lesson.id}`;
      const description =
        lessonDescription(lesson.passport, say(lesson.language)) ??
        say(lesson.language)('app.description');
      expect(html).toContain(`<html lang="${lesson.language}">`);
      expect(unescape(attr(html, /<title>([^<]*)<\/title>/))).toBe(pageTitle(lesson.title));
      expect(unescape(metaContent(html, 'description'))).toBe(description);
      expect(unescape(metaContent(html, 'og:title'))).toBe(lesson.title);
      expect(unescape(metaContent(html, 'og:description'))).toBe(description);
      expect(metaContent(html, 'og:url')).toBe(url);
      expect(metaContent(html, 'og:image')).toBe(
        `${ORIGIN}/${lessonCardFile(lesson.id, lesson.language)}`,
      );
      expect(metaContent(html, 'og:image:width')).toBe('1200');
      expect(metaContent(html, 'og:image:height')).toBe('630');
      expect(metaContent(html, 'twitter:card')).toBe('summary_large_image');
      expect(metaContent(html, 'twitter:image')).toBe(metaContent(html, 'og:image'));
      expect(attr(html, /<link rel="canonical" href="([^"]*)" \/>/)).toBe(url);
      for (const lang of languages) {
        expect(html).toContain(
          `<link rel="alternate" hreflang="${lang}" href="${ORIGIN}/${lang}/lesson/${lesson.id}" />`,
        );
      }
      expect(html).toContain(
        `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/${languages[0] ?? ''}/lesson/${lesson.id}" />`,
      );
      // One description, one title: the default of index.html is gone.
      expect(html.match(/name="description"/g)).toHaveLength(1);
      expect(html.match(/<title>/g)).toHaveLength(1);
      // The same app boots.
      expect(html).toContain(
        '<script type="module" crossorigin src="/assets/index-x.js"></script>',
      );
    },
  );

  it('gives every lesson a description of its own in each language', () => {
    for (const lang of languages) {
      const own = lessons
        .filter((l) => l.language === lang)
        .map((l) => metaContent(text(`${lang}/lesson/${l.id}.html`), 'description'));
      expect(new Set(own).size).toBe(own.length);
      expect(own).not.toContain(say(lang)('app.description'));
    }
  });

  it('gives «About» its title, description and the site card', () => {
    for (const lang of languages) {
      const html = text(`${lang}/about.html`);
      const t = say(lang);
      expect(unescape(attr(html, /<title>([^<]*)<\/title>/))).toBe(pageTitle(t('about.title')));
      expect(unescape(metaContent(html, 'description'))).toBe(t('about.description'));
      expect(metaContent(html, 'og:image')).toBe(`${ORIGIN}/${siteCardFile(lang)}`);
      expect(metaContent(html, 'og:type')).toBe('website');
      expect(attr(html, /<link rel="canonical" href="([^"]*)" \/>/)).toBe(
        `${ORIGIN}/${lang}/about`,
      );
    }
  });

  it('every page path is the address the router reads as that page', () => {
    for (const lesson of lessons) {
      const route = parseAddress(`/${lesson.language}/lesson/${lesson.id}`, '', {
        languages,
        fallback: 'ru',
        home: 'I1',
      });
      expect(route).toMatchObject({
        kind: 'lesson',
        place: { lang: lesson.language, lesson: lesson.id, step: 1, defence: false },
      });
    }
    for (const lang of languages) {
      expect(parseAddress(`/${lang}/about`, '', { languages, fallback: 'ru', home: 'I1' })).toEqual(
        {
          kind: 'about',
          lang,
        },
      );
    }
  });

  it('index.html keeps no canonical (it answers every unknown path) and has the site card', () => {
    const html = text('index.html');
    const base = languages[0] ?? '';
    expect(html).toContain(`<html lang="${base}">`);
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('hreflang');
    expect(unescape(metaContent(html, 'description'))).toBe(say(base)('app.description'));
    expect(metaContent(html, 'og:image')).toBe(`${ORIGIN}/${siteCardFile(base)}`);
    expect(metaContent(html, 'og:url')).toBe(`${ORIGIN}/`);
  });

  it('a lesson without a card of its own gets the site card; with no cards at all, none', () => {
    const k1 = lessons[0];
    if (k1 === undefined) throw new Error('no lessons');
    const path = `${k1.language}/lesson/${k1.id}.html`;
    const without = new Set(allCards);
    without.delete(lessonCardFile(k1.id, k1.language));
    expect(metaContent(text(path, without), 'og:image')).toBe(
      `${ORIGIN}/${siteCardFile(k1.language)}`,
    );
    const bare = text(path, new Set());
    expect(metaContent(bare, 'og:image')).toBeNull();
    expect(metaContent(bare, 'twitter:card')).toBe('summary');
  });
});

describe('SITE_ORIGIN', () => {
  it('is one https origin without a path (K120: hacks.antipic.com)', () => {
    expect(SITE_ORIGIN).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  });
});

describe('sitemap.xml and robots.txt', () => {
  const xml = text('sitemap.xml');
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1] ?? '');

  it('lists every page in every site language once', () => {
    const locs = urls.map((u) => attr(u, /<loc>([^<]*)<\/loc>/));
    const want = [
      ...languages.map((lang) => `${ORIGIN}/${lang}/about`),
      ...lessons.map((l) => `${ORIGIN}/${l.language}/lesson/${l.id}`),
    ];
    expect([...locs].sort()).toEqual([...want].sort());
    expect(urls).toHaveLength(want.length);
  });

  it('gives each address its alternates in every language and x-default', () => {
    for (const url of urls) {
      const links = [
        ...url.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g),
      ];
      expect(links.map((m) => m[1])).toEqual([...languages, 'x-default']);
      // The address is among its own alternates.
      const loc = attr(url, /<loc>([^<]*)<\/loc>/);
      expect(links.map((m) => m[2])).toContain(loc);
    }
  });

  it('is a well-formed sitemap document', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset ')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml.match(/<url>/g)?.length).toBe(xml.match(/<\/url>/g)?.length);
  });

  it('robots.txt allows all and names the sitemap at the origin', () => {
    expect(text('robots.txt')).toBe(robotsTxt(ORIGIN));
    expect(robotsTxt(ORIGIN)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

describe('hostile input', () => {
  const evil: PageLesson = {
    id: 'Z9',
    language: 'ru',
    title: '"><script>alert(1)</script>',
    passport: { class: "<b>x</b>' onload='y", impact: 'a & b', defence: 'c' },
    icons: [],
  };
  const tiny: SiteLocalesData = {
    languages: [{ code: 'ru', name: 'Russian' }],
    strings: {
      ru: {
        'app.description': 'site',
        'about.title': 'About',
        'about.description': 'about',
        'meta.lesson.description': '{class}. {impact}. {defence}.',
      },
    },
  };

  it('escapes lesson text everywhere it goes', () => {
    const out = sitePages({
      origin: `${ORIGIN}/`,
      indexHtml: INDEX,
      locales: tiny,
      lessons: [evil],
      cards: new Set(),
    });
    const html = out.find((f) => f.path === 'ru/lesson/Z9.html')?.text ?? '';
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain("onload='y");
    expect(html).toContain(escapeHtml(evil.title));
    // A slash at the end of the origin is not doubled.
    expect(html).toContain(`href="${ORIGIN}/ru/lesson/Z9"`);
  });

  it('refuses an index.html without a head to put the tags in', () => {
    const head = {
      lang: 'ru',
      title: 't',
      description: 'd',
      type: 'website' as const,
      name: 'n',
      url: ORIGIN,
      canonical: false,
      alternates: [],
      image: null,
    };
    expect(() => withHead('<p>no page</p>', head)).toThrow('index.html');
    expect(() => withHead('<html><title>t</title><body>', head)).toThrow('</head>');
  });
});
