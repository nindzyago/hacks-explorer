<script lang="ts">
  // The page «About» (M3.9, `/<lang>/about`): what the site is, how to read a lesson, the ready
  // lessons, principles, licences and how to help. Every word comes from the interface strings
  // (content/locales/<lang>/ui.md, K105); the ready lessons come from the topics of the page's
  // language (data/topics/<lang>.json, K112): ready = the lesson has a file in that language.
  import type { SiteTopics } from '../core/topics/site';
  import { aroundPlaceholder } from '../core/i18n/say';
  import { PROJECT, shownAddress } from '../core/project';
  import { readyCount } from '../core/topics/search';
  import type { Translate } from '../services/i18n/i18n';
  import { formatAddress } from '../services/router/address';
  import type { TopicsLoader } from '../services/topics/topics';

  const {
    loader,
    language,
    home,
    t,
    onopen,
  }: {
    loader: TopicsLoader;
    language: string;
    /** The site's base path. */
    home: string;
    t: Translate;
    /** The reader picked a ready lesson: its path within the site. */
    onopen: (path: string) => void;
  } = $props();

  type Data =
    | { readonly state: 'loading' }
    | { readonly state: 'ready'; readonly topics: SiteTopics }
    | { readonly state: 'error' };
  let data = $state.raw<Data>({ state: 'loading' });
  let attempt = $state(0);
  let heading = $state<HTMLElement | null>(null);

  $effect(() => {
    const lang = language;
    if (attempt < 0) return;
    let live = true;
    data = { state: 'loading' };
    void loader.topics(lang).then(
      (result) => {
        if (live) data = result.ok ? { state: 'ready', topics: result.value } : { state: 'error' };
      },
      () => {
        if (live) data = { state: 'error' };
      },
    );
    return () => {
      live = false;
    };
  });

  // The heading takes the focus when the page opens, as «no such page» does (K81).
  $effect(() => {
    heading?.focus();
  });

  const base = $derived(home.endsWith('/') ? home.slice(0, -1) : home);
  const sections = $derived(data.state === 'ready' ? data.topics.sections : []);
  const ready = $derived(
    sections.flatMap((s) => s.topics.filter((topic) => topic.ready).map((topic) => topic)),
  );
  const total = $derived(
    sections.reduce(
      (sum, s) => {
        const c = readyCount(s);
        return { ready: sum.ready + c.ready, count: sum.count + c.count };
      },
      { ready: 0, count: 0 },
    ),
  );
  const pathOf = (id: string) =>
    formatAddress({ lang: language, lesson: id, step: 1, defence: false });

  const READ = [
    'about.read.scene',
    'about.read.steps',
    'about.read.play',
    'about.read.defence',
    'about.read.depth',
    'about.read.glossary',
  ] as const;
  const PRINCIPLES = [
    'about.principles.fictional',
    'about.principles.addresses',
    'about.principles.facts',
    'about.principles.tracking',
  ] as const;
  const LICENCES = [
    'about.licences.code',
    'about.licences.lessons',
    'about.licences.fonts',
    'about.licences.icons',
  ] as const;
</script>

<!-- OPEN1: a sentence with an outside link in place of its `{link}`. A plain link the reader
     follows, never a request (L6); no referrer and no opener go with it. -->
{#snippet withLink(text: string, href: string, label: string, testid: string)}
  {@const parts = aroundPlaceholder(text, 'link')}
  {#if parts === null}
    {text}
    <a class="out" {href} target="_blank" rel="noopener noreferrer" data-testid={testid}>{label}</a>
  {:else}
    {parts.before}<a
      class="out"
      {href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testid}>{label}</a
    >{parts.after}
  {/if}
{/snippet}

<!-- M6.1: the page in the same blueprint panel as the lesson screen. -->
<article class="bp-panel about" data-testid="about" aria-labelledby="about-title">
  <div class="bp-head">
    <h2
      class="bp-title"
      id="about-title"
      tabindex="-1"
      data-testid="about-title"
      bind:this={heading}
    >
      {t('about.title')}
    </h2>
  </div>
  <div class="body">
    <p class="lead">{t('about.lead')}</p>
    <p data-testid="about-genre">
      {@render withLink(
        t('about.genre'),
        PROJECT.genre.url,
        PROJECT.genre.name,
        'about-genre-link',
      )}
    </p>

    <section aria-labelledby="about-read">
      <h3 id="about-read">{t('about.read.title')}</h3>
      <ul>
        {#each READ as key (key)}
          <li>{t(key)}</li>
        {/each}
      </ul>
    </section>

    <section aria-labelledby="about-lessons" data-testid="about-lessons">
      <h3 id="about-lessons">{t('about.lessons.title')}</h3>
      {#if data.state === 'loading'}
        <p role="status">{t('catalog.loading')}</p>
      {:else if data.state === 'error'}
        <div class="error" role="alert">
          <p>{t('catalog.error')}</p>
          <button
            type="button"
            onclick={() => {
              attempt += 1;
            }}>{t('lesson.retry')}</button
          >
        </div>
      {:else}
        <ul class="lessons">
          {#each ready as topic (topic.id)}
            <li>
              <a
                href="{base}{pathOf(topic.id)}"
                data-testid="about-lesson"
                data-topic={topic.id}
                onclick={(event) => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onopen(pathOf(topic.id));
                }}><span class="id">{topic.id}</span> {topic.title}</a
              >
            </li>
          {/each}
        </ul>
        <p class="count" data-testid="about-count">{t('about.lessons.count', total)}</p>
      {/if}
    </section>

    <section aria-labelledby="about-principles">
      <h3 id="about-principles">{t('about.principles.title')}</h3>
      <ul>
        {#each PRINCIPLES as key (key)}
          <li>{t(key)}</li>
        {/each}
      </ul>
    </section>

    <section aria-labelledby="about-licences">
      <h3 id="about-licences">{t('about.licences.title')}</h3>
      <ul>
        {#each LICENCES as key (key)}
          <li>{t(key)}</li>
        {/each}
      </ul>
    </section>

    <section aria-labelledby="about-help">
      <h3 id="about-help">{t('about.help.title')}</h3>
      <p data-testid="about-help">
        {@render withLink(
          t('about.help.text'),
          PROJECT.repository,
          shownAddress(PROJECT.repository),
          'about-repo-link',
        )}
      </p>
    </section>
  </div>
</article>

<style>
  .about {
    width: 100%;
    max-width: 50rem;
    margin: 0 auto;
    overflow-wrap: anywhere;
  }

  .body {
    padding: var(--space-4) var(--space-6) var(--space-6);
  }

  h3 {
    margin: var(--space-6) 0 var(--space-2);
    padding-bottom: var(--space-1);
    border-bottom: var(--line-width) solid var(--line-faint);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: var(--caps-spacing);
    text-transform: uppercase;
    color: var(--legit);
  }

  p {
    margin: 0 0 var(--space-2);
  }

  .lead {
    font-size: var(--text-lg);
  }
  /* OPEN1: a link inside a sentence, underlined so it is told apart without colour (WCAG 1.4.1);
     an inline link is exempt from the target size (2.5.8). */
  .out {
    color: var(--legit);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  ul {
    margin: 0;
    padding-left: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .lessons {
    list-style: none;
    padding: 0;
    gap: 0;
  }

  .lessons li {
    border-bottom: var(--line-width) solid var(--line-faint);
  }

  .lessons a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--legit);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .id {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .count {
    margin-top: var(--space-2);
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .error button {
    min-height: 44px;
    padding: 0 var(--space-4);
    border: var(--frame-width) solid var(--legit);
    border-radius: var(--radius-xs);
    background: var(--legit);
    color: var(--panel);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
  }

  @media (max-width: 760px) {
    .body {
      padding: var(--space-4);
    }
  }
</style>
