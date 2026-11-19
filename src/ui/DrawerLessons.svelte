<script lang="ts">
  // The «Уроки» tab of the side panel (M2.1b, D1 a, E2, scenario S7): every section and every
  // topic of the site; a ready lesson is a link that opens it, the others are grey with «скоро».
  // Search by title, section and id; a section filter; an empty result says so and offers a
  // reset. The topics of the page's language load the first time the tab shows.
  import type { SiteTopics } from '../core/topics/site';
  import { filterTopics, MAX_QUERY_LENGTH, readyCount } from '../core/topics/search';
  import type { Translate } from '../services/i18n/i18n';
  import { formatAddress } from '../services/router/address';
  import type { TopicsLoader } from '../services/topics/topics';

  const {
    loader,
    language,
    current,
    home,
    t,
    onopen,
  }: {
    loader: TopicsLoader;
    language: string;
    /** The lesson on the page: marked «открыт сейчас». */
    current: string;
    /** The site's base path. */
    home: string;
    t: Translate;
    /** The reader picked a ready lesson. */
    onopen: (id: string) => void;
  } = $props();
  const uid = $props.id();

  type Data =
    | { readonly state: 'loading' }
    | { readonly state: 'ready'; readonly topics: SiteTopics }
    | { readonly state: 'error' };
  let data = $state.raw<Data>({ state: 'loading' });
  let attempt = $state(0);
  let query = $state('');
  let section = $state('');
  let search = $state<HTMLInputElement | null>(null);

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

  const sections = $derived(data.state === 'ready' ? data.topics.sections : []);
  const found = $derived(
    filterTopics(sections, { query, section: section === '' ? null : section }),
  );
  const filtered = $derived(query.trim() !== '' || section !== '');
  const total = $derived(
    sections.reduce(
      (sum, s) => {
        const c = readyCount(s);
        return { ready: sum.ready + c.ready, count: sum.count + c.count };
      },
      { ready: 0, count: 0 },
    ),
  );
  const foundCount = $derived(found.reduce((sum, f) => sum + f.topics.length, 0));
  const base = $derived(home.endsWith('/') ? home.slice(0, -1) : home);

  function reset(): void {
    query = '';
    section = '';
    search?.focus();
  }

  /** The search field, for the panel to focus when it opens. */
  export function focusSearch(): void {
    search?.focus();
  }
</script>

<div class="lessons" data-testid="catalog" data-state={data.state}>
  <div class="filters">
    <div class="field grow">
      <label for="{uid}-q">{t('catalog.search')}</label>
      <input
        id="{uid}-q"
        type="search"
        autocomplete="off"
        spellcheck="false"
        maxlength={MAX_QUERY_LENGTH}
        placeholder={t('catalog.searchHint')}
        data-testid="catalog-search"
        bind:value={query}
        bind:this={search}
      />
    </div>
    <div class="field">
      <label for="{uid}-s">{t('catalog.section')}</label>
      <select id="{uid}-s" data-testid="catalog-section" bind:value={section}>
        <option value="">{t('catalog.allSections')}</option>
        {#each sections as s (s.id)}
          <option value={s.id}>{s.id}. {s.title}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if data.state === 'loading'}
    <p class="note" role="status">{t('catalog.loading')}</p>
  {:else if data.state === 'error'}
    <div class="note" role="alert">
      <p>{t('catalog.error')}</p>
      <button
        type="button"
        class="action"
        data-testid="catalog-retry"
        onclick={() => {
          attempt += 1;
        }}>{t('lesson.retry')}</button
      >
    </div>
  {:else}
    <p class="status" role="status" data-testid="catalog-status">
      {filtered ? t('catalog.found', { count: foundCount }) : t('catalog.total', total)}
    </p>
    {#if found.length === 0}
      <div class="empty" data-testid="catalog-empty">
        <p>{t('catalog.empty')}</p>
        <button type="button" class="action" data-testid="catalog-reset" onclick={reset}
          >{t('catalog.reset')}</button
        >
      </div>
    {:else}
      <div class="list" data-testid="catalog-list">
        {#each found as f (f.section.id)}
          {@const counts = readyCount(f.section)}
          <section
            class="section"
            aria-labelledby="{uid}-{f.section.id}"
            data-testid="catalog-group"
            data-section={f.section.id}
          >
            <div class="section-head">
              <h3 id="{uid}-{f.section.id}">
                <span class="sid">{f.section.id}</span>
                {f.section.title}
              </h3>
              <span class="count" data-testid="catalog-count">{t('catalog.ready', counts)}</span>
            </div>
            <ul>
              {#each f.topics as topic (topic.id)}
                <li data-testid="catalog-topic" data-topic={topic.id} data-ready={topic.ready}>
                  {#if topic.ready}
                    <a
                      class="topic ready"
                      href="{base}{formatAddress({
                        lang: language,
                        lesson: topic.id,
                        step: 1,
                        defence: false,
                      })}"
                      aria-current={topic.id === current ? 'page' : undefined}
                      data-testid="catalog-open"
                      onclick={(event) => {
                        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
                          return;
                        event.preventDefault();
                        onopen(topic.id);
                      }}
                    >
                      <span class="tid">{topic.id}</span>
                      <span class="text">
                        <span class="title">{topic.title}</span>
                        {#if topic.note !== null}<span class="sub">{topic.note}</span>{/if}
                      </span>
                      {#if topic.id === current}<span class="badge now">{t('catalog.current')}</span
                        >{/if}
                    </a>
                  {:else}
                    <div class="topic soon" title={t('catalog.soonTitle')}>
                      <span class="tid">{topic.id}</span>
                      <span class="text">
                        <span class="title">{topic.title}</span>
                        {#if topic.note !== null}<span class="sub">{topic.note}</span>{/if}
                      </span>
                      <span class="badge">{t('catalog.soon')}</span>
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .lessons {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    flex: 1 1 9rem;
  }

  .field.grow {
    flex: 2 1 12rem;
  }

  label {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  input,
  select {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-md);
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-md);
  }

  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--legit);
    outline-offset: 1px;
  }

  .status,
  .note {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .note p,
  .empty p {
    margin: 0 0 var(--space-2);
  }

  .empty {
    padding: var(--space-3);
    border: var(--line-width) dashed var(--line);
    border-radius: var(--radius-md);
    color: var(--ink);
  }

  .action {
    min-height: 44px;
    padding: 0 var(--space-4);
    border: var(--line-width) solid var(--legit);
    border-radius: var(--radius-md);
    background: var(--legit);
    color: var(--panel);
    font: inherit;
    cursor: pointer;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-1) var(--space-2);
    padding-bottom: var(--space-1);
    border-bottom: var(--line-width) solid var(--line);
  }

  h3 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--ink);
  }

  .sid {
    font-family: var(--font-mono);
    color: var(--muted);
  }

  .count {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--muted);
  }

  ul {
    margin: var(--space-1) 0 0;
    padding: 0;
    list-style: none;
  }

  .topic {
    box-sizing: border-box;
    min-height: 44px;
    padding: var(--space-1) var(--space-2);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .tid {
    flex: none;
    min-width: 2rem;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
  }

  .text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .sub {
    font-size: var(--text-xs);
    color: var(--muted);
  }

  .ready {
    color: var(--legit);
    text-decoration: none;
  }

  .ready .title {
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .ready:hover {
    background: var(--paper);
  }

  .ready:focus-visible {
    outline: 2px solid var(--legit);
    outline-offset: -2px;
  }

  .ready[aria-current='page'] {
    background: var(--paper);
  }

  .soon {
    color: var(--muted);
  }

  .badge {
    flex: none;
    padding: 0 var(--space-1);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--muted);
  }

  .badge.now {
    border-color: var(--legit);
    color: var(--legit);
  }
</style>
