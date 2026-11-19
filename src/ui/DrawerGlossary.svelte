<script lang="ts">
  // The «Словарь» tab of the side panel (M2.1b, E4): the glossary of M2.4 as a list by category
  // with a search; a term opens its definition here, in the panel (the state's `glossary`, run by
  // `glossary.open` as everywhere). «См. также» and the words inside a definition open the next
  // term here too; a related lesson opens the lesson and closes the panel.
  import { tick } from 'svelte';
  import type { SiteGlossary } from '../core/glossary/site';
  import { matchesAll, MAX_QUERY_LENGTH, queryWords } from '../core/topics/search';
  import type { GlossaryLoader } from '../services/glossary/glossary';
  import type { Translate } from '../services/i18n/i18n';
  import RichBlocks from './RichBlocks.svelte';

  const {
    loader,
    language,
    open,
    t,
    run,
    onopen,
  }: {
    loader: GlossaryLoader;
    language: string;
    /** The term whose definition shows, or null for the list. */
    open: string | null;
    t: Translate;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    /** The reader picked a related lesson. */
    onopen: (id: string) => void;
  } = $props();
  const uid = $props.id();

  type Data =
    | { readonly state: 'loading' }
    | { readonly state: 'ready'; readonly glossary: SiteGlossary }
    | { readonly state: 'error' };
  let data = $state.raw<Data>({ state: 'loading' });
  let attempt = $state(0);
  let query = $state('');
  let search = $state<HTMLInputElement | null>(null);
  let heading = $state<HTMLElement | null>(null);
  /** The term the reader came from: focus returns to it from «Все слова». */
  let from: string | null = null;

  $effect(() => {
    const lang = language;
    if (attempt < 0) return;
    let live = true;
    data = { state: 'loading' };
    void loader.glossary(lang).then(
      (result) => {
        if (live)
          data = result.ok ? { state: 'ready', glossary: result.value } : { state: 'error' };
      },
      () => {
        if (live) data = { state: 'error' };
      },
    );
    return () => {
      live = false;
    };
  });

  const glossary = $derived(data.state === 'ready' ? data.glossary : null);
  const term = $derived(
    open === null || glossary === null ? undefined : glossary.terms.find((x) => x.id === open),
  );
  const titles = $derived(new Map(glossary?.terms.map((x) => [x.id, x.title]) ?? []));
  const labels = $derived(new Map(glossary?.categories.map((c) => [c.id, c.label]) ?? []));
  const groups = $derived.by(() => {
    if (glossary === null) return [];
    const words = queryWords(query);
    return glossary.categories
      .map((c) => ({
        category: c,
        terms: glossary.terms
          .filter((x) => x.category === c.id && matchesAll(words, [x.title, c.label, x.id]))
          .sort((a, b) => a.title.localeCompare(b.title, language)),
      }))
      .filter((g) => g.terms.length > 0);
  });
  const foundCount = $derived(groups.reduce((sum, g) => sum + g.terms.length, 0));

  // A definition that opens takes the focus on its heading; back in the list, the term does.
  $effect(() => {
    const id = open;
    if (term === undefined) {
      if (id !== null || from === null) return;
      const back = from;
      from = null;
      void tick().then(() => {
        document
          .querySelector<HTMLElement>(
            `[data-testid="glossary-term"][data-term="${CSS.escape(back)}"]`,
          )
          ?.focus();
      });
      return;
    }
    void tick().then(() => {
      heading?.focus();
    });
  });

  function openTermHere(id: string): void {
    if (open === null) from = id;
    run('glossary.open', { id });
  }

  /** The search field, for the panel to focus when it opens. */
  export function focusSearch(): void {
    search?.focus();
  }
</script>

<div class="glossary" data-testid="glossary-list" data-state={data.state}>
  {#if data.state === 'loading'}
    <p class="note" role="status">{t('glossary.loading')}</p>
  {:else if data.state === 'error'}
    <div class="note" role="alert">
      <p>{t('glossary.error')}</p>
      <button
        type="button"
        class="action"
        data-testid="glossary-list-retry"
        onclick={() => {
          attempt += 1;
        }}>{t('lesson.retry')}</button
      >
    </div>
  {:else if open !== null}
    <div class="definition-view" data-testid="glossary-entry" data-term={open}>
      <button
        type="button"
        class="back"
        data-testid="glossary-back"
        onclick={() => {
          run('glossary.close');
        }}>← {t('glossaryList.back')}</button
      >
      {#if term === undefined}
        <p class="note">{t('glossary.unknown')}</p>
      {:else}
        <span class="tag">{labels.get(term.category) ?? ''}</span>
        <h3 tabindex="-1" bind:this={heading} data-testid="glossary-entry-title">{term.title}</h3>
        <div class="definition" data-testid="glossary-entry-definition">
          <RichBlocks blocks={term.definition} {t} />
        </div>
        {#if term.see.length > 0}
          <p class="label" id="{uid}-see">{t('glossary.see')}</p>
          <ul class="chips" aria-labelledby="{uid}-see">
            {#each term.see as id (id)}
              <li>
                <button
                  type="button"
                  class="chip"
                  data-testid="glossary-entry-see"
                  data-term={id}
                  onclick={() => {
                    run('glossary.open', { id });
                  }}>{titles.get(id) ?? id}</button
                >
              </li>
            {/each}
          </ul>
        {/if}
        {#if term.lessons.length > 0}
          <p class="label" id="{uid}-lessons">{t('glossary.lessons')}</p>
          <ul class="chips" aria-labelledby="{uid}-lessons">
            {#each term.lessons as lesson (lesson.id)}
              <li>
                <button
                  type="button"
                  class="chip lesson"
                  data-testid="glossary-entry-lesson"
                  data-lesson={lesson.id}
                  onclick={() => {
                    onopen(lesson.id);
                  }}>{lesson.title}</button
                >
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>
  {:else}
    <div class="field">
      <label for="{uid}-q">{t('glossaryList.search')}</label>
      <input
        id="{uid}-q"
        type="search"
        autocomplete="off"
        spellcheck="false"
        maxlength={MAX_QUERY_LENGTH}
        placeholder={t('glossaryList.searchHint')}
        data-testid="glossary-search"
        bind:value={query}
        bind:this={search}
      />
    </div>
    {#if query.trim() !== ''}
      <p class="note" role="status">{t('glossaryList.found', { count: foundCount })}</p>
    {/if}
    {#if groups.length === 0}
      <div class="empty" data-testid="glossary-empty">
        <p>{t('glossaryList.empty')}</p>
        <button
          type="button"
          class="action"
          data-testid="glossary-reset"
          onclick={() => {
            query = '';
            search?.focus();
          }}>{t('catalog.reset')}</button
        >
      </div>
    {:else}
      {#each groups as g (g.category.id)}
        <section class="group" aria-labelledby="{uid}-{g.category.id}">
          <h3 class="group-title" id="{uid}-{g.category.id}">{g.category.label}</h3>
          <ul class="terms">
            {#each g.terms as x (x.id)}
              <li>
                <button
                  type="button"
                  class="term"
                  data-testid="glossary-term"
                  data-term={x.id}
                  onclick={() => {
                    openTermHere(x.id);
                  }}>{x.title}</button
                >
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    {/if}
  {/if}
</div>

<style>
  .glossary,
  .definition-view {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .definition-view {
    gap: var(--space-2);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  label,
  .label,
  .tag,
  .group-title {
    margin: 0;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  .group-title {
    padding-bottom: var(--space-1);
    border-bottom: var(--line-width) solid var(--line);
  }

  input {
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

  input:focus-visible {
    outline: 2px solid var(--legit);
    outline-offset: 1px;
  }

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

  .terms {
    margin: var(--space-1) 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-1);
  }

  .term {
    min-height: 44px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--legit);
    font: inherit;
    font-size: var(--text-sm);
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  .term:hover {
    background: var(--paper);
  }

  .back {
    align-self: flex-start;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-md);
    background: var(--panel);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  h3 {
    margin: 0;
    font-size: var(--text-lg);
    line-height: 1.2;
    color: var(--ink);
    overflow-wrap: anywhere;
  }

  .definition {
    font-size: var(--text-sm);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .chips {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: var(--line-width) solid var(--legit);
    border-radius: var(--radius-md);
    background: var(--panel);
    color: var(--legit);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  .chip.lesson {
    background: var(--legit);
    color: var(--panel);
  }
</style>
