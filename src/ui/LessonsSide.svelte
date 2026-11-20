<script lang="ts">
  // The left column of the lesson screen on a wide window (M6.1, design §2): the panel «Уроки»
  // with the tab «Словарь», always open, not a dialog. The lessons tab is a list of the ready
  // lessons (the topics still being written at the end, K112); the open lesson is unfolded with
  // its steps — a circle in the colour of the step, the current one outlined; a step runs
  // `player.goto`, another lesson `lesson.open`. The search and the section chips stand in the top
  // bar and filter this list. The glossary tab is the glossary of the side panel (M2.1b): while it
  // shows, a glossary word on the page opens its definition here, not in place.
  import { tick } from 'svelte';
  import type { SiteLesson } from '../core/lesson/site';
  import { stepsInMode } from '../core/scene-layout/message';
  import type { SiteTopicSection } from '../core/topics/site';
  import { sideList } from '../core/topics/search';
  import type { GlossaryLoader } from '../services/glossary/glossary';
  import type { Translate } from '../services/i18n/i18n';
  import { formatAddress } from '../services/router/address';
  import DrawerGlossary from './DrawerGlossary.svelte';
  import { setTermOpener } from './terms';

  let {
    sections,
    status,
    lesson,
    current,
    step,
    defence,
    language,
    glossary,
    term,
    home,
    t,
    run,
    query,
    section,
    tab = $bindable('lessons'),
  }: {
    sections: readonly SiteTopicSection[];
    /** The topics of the page's language: loading, ready or failed (with a retry). */
    status: 'loading' | 'ready' | 'error';
    /** The lesson on the page, once loaded: its steps unfold under its row. */
    lesson: SiteLesson | null;
    /** The id of the lesson on the page. */
    current: string;
    step: number;
    defence: boolean;
    language: string;
    glossary: GlossaryLoader;
    /** The glossary term open (the state's `glossary`). */
    term: string | null;
    home: string;
    t: Translate;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    query: string;
    section: string;
    tab?: 'lessons' | 'glossary';
  } = $props();
  const uid = $props.id();

  /** «Готовые» or «Все»: the chips of the panel. */
  let all = $state(false);
  let glossaryQuery = $state('');
  const list = $derived(
    sideList(sections, { query, section: section === '' ? null : section, all }),
  );
  const base = $derived(home.endsWith('/') ? home.slice(0, -1) : home);
  const steps = $derived(lesson === null ? [] : stepsInMode(lesson.steps, defence));

  const pathOf = (id: string) =>
    `${base}${formatAddress({ lang: language, lesson: id, step: 1, defence: false })}`;

  function open(event: MouseEvent, id: string): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (id !== current) run('lesson.open', { id });
  }

  // While the glossary tab shows, a word on the page opens its definition in the panel.
  $effect(() => {
    if (tab !== 'glossary') return;
    return setTermOpener((id) => {
      run('glossary.open', { id });
    });
  });

  /** ← and → move between the two tabs, as in any tab list. */
  function ontabkey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    tab = tab === 'lessons' ? 'glossary' : 'lessons';
    const next = tab;
    void tick().then(() => {
      document.getElementById(`${uid}-tab-${next}`)?.focus();
    });
  }

  // The open lesson is scrolled into the column's view when it opens or the list changes; only
  // the column scrolls, never the page.
  let body = $state<HTMLElement | null>(null);
  $effect(() => {
    const element = body;
    if (element === null || tab !== 'lessons' || list.ready.length === 0) return;
    if (current === '' || steps.length === 0) return;
    void tick().then(() => {
      const here = element.querySelector<HTMLElement>('li.here');
      if (here === null) return;
      const top = here.offsetTop;
      const bottom = top + here.offsetHeight;
      if (top < element.scrollTop) element.scrollTop = top;
      else if (bottom > element.scrollTop + element.clientHeight)
        element.scrollTop = Math.max(0, bottom - element.clientHeight);
    });
  });

  function paint(s: { readonly kind: string; readonly stopped: boolean }): string {
    return s.stopped ? 'stopped' : s.kind;
  }
</script>

<aside class="bp-panel side" data-testid="lessons-panel" aria-labelledby="{uid}-tab-{tab}">
  <div class="bp-head head">
    <div class="tabs" role="tablist" aria-label={t('drawer.tabs')}>
      <button
        type="button"
        role="tab"
        class="bp-title tab"
        id="{uid}-tab-lessons"
        aria-selected={tab === 'lessons'}
        aria-controls="{uid}-panel"
        tabindex={tab === 'lessons' ? 0 : -1}
        data-testid="side-tab-lessons"
        onkeydown={ontabkey}
        onclick={() => {
          tab = 'lessons';
        }}>{t('drawer.lessons')}</button
      >
      <button
        type="button"
        role="tab"
        class="bp-title tab"
        id="{uid}-tab-glossary"
        aria-selected={tab === 'glossary'}
        aria-controls="{uid}-panel"
        tabindex={tab === 'glossary' ? 0 : -1}
        data-testid="side-tab-glossary"
        onkeydown={ontabkey}
        onclick={() => {
          tab = 'glossary';
        }}>{t('drawer.glossary')}</button
      >
    </div>
  </div>
  <div
    class="body"
    role="tabpanel"
    id="{uid}-panel"
    aria-labelledby="{uid}-tab-{tab}"
    bind:this={body}
  >
    {#if tab === 'glossary'}
      <div class="words">
        <DrawerGlossary
          loader={glossary}
          {language}
          open={term}
          bind:query={glossaryQuery}
          {t}
          {run}
          onopen={(id) => {
            tab = 'lessons';
            run('lesson.open', { id });
          }}
        />
      </div>
    {:else if status === 'loading'}
      <p class="note" role="status">{t('catalog.loading')}</p>
    {:else if status === 'error'}
      <p class="note" role="alert">{t('catalog.error')}</p>
    {:else}
      <div class="chips" role="group" aria-label={t('screen.lessonsFilter')}>
        <button
          type="button"
          class="bp-chip"
          aria-pressed={!all}
          data-testid="side-ready"
          onclick={() => {
            all = false;
          }}>{t('screen.lessonsReady', { count: list.readyCount })}</button
        >
        <button
          type="button"
          class="bp-chip"
          aria-pressed={all}
          data-testid="side-all"
          onclick={() => {
            all = true;
          }}>{t('screen.lessonsAll', { count: list.allCount })}</button
        >
      </div>
      {#if list.ready.length === 0 && list.soon.length === 0}
        <p class="note" data-testid="side-empty">{t('catalog.empty')}</p>
      {:else}
        <ul class="list" data-testid="side-list">
          {#each list.ready as topic (topic.id)}
            {@const here = topic.id === current}
            <li class:here data-testid="side-lesson" data-topic={topic.id}>
              <a
                class="row"
                href={pathOf(topic.id)}
                aria-current={here ? 'page' : undefined}
                data-testid="side-open"
                onclick={(event) => {
                  open(event, topic.id);
                }}
              >
                <span class="text">
                  <span class="title">{topic.title}</span>
                  <span class="sub"
                    >{topic.id}{#if topic.note !== null}&nbsp;· {topic.note}{/if}</span
                  >
                </span>
                <span class="mark" aria-hidden="true">{here ? '▾' : '›'}</span>
              </a>
              {#if here && steps.length > 0 && lesson?.id === topic.id}
                <ol
                  class="steps"
                  aria-label={t('screen.lessonSteps', { title: lesson.title })}
                  data-testid="side-steps"
                >
                  {#each steps as s, i (i)}
                    {@const n = i + 1}
                    <li>
                      <button
                        type="button"
                        class="step"
                        class:future={n > step}
                        class:now={n === step}
                        aria-current={n === step ? 'step' : undefined}
                        data-testid="side-step-{n}"
                        onclick={() => {
                          run('player.goto', { step: n });
                        }}
                      >
                        <span class="dot {paint(s)}" aria-hidden="true">{n}</span>
                        <span class="step-title">{s.title}</span>
                      </button>
                    </li>
                  {/each}
                </ol>
              {/if}
            </li>
          {/each}
          {#each list.soon as topic (topic.id)}
            <li class="soon" data-testid="side-soon" data-topic={topic.id}>
              <div class="row" title={t('catalog.soonTitle')}>
                <span class="text">
                  <span class="title">{topic.title}</span>
                  <span class="sub">{topic.id} · {t('catalog.soon')}</span>
                </span>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
</aside>

<style>
  .side {
    height: 100%;
  }

  .head {
    padding-block: 0;
  }

  .tabs {
    display: flex;
    gap: var(--space-3);
    align-self: stretch;
  }

  .tab {
    box-sizing: border-box;
    min-height: calc(var(--target) + 2 * var(--space-2));
    padding: 0 var(--space-1);
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .tab[aria-selected='true'] {
    border-bottom-color: var(--legit);
    color: var(--legit);
  }

  .tab:focus-visible {
    outline-offset: -3px;
  }

  .body {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .words {
    padding: var(--space-3);
  }

  .note {
    margin: 0;
    padding: var(--space-3);
    font-size: var(--text-sm);
    color: var(--muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--line-width) solid var(--line-faint);
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .list > li {
    border-bottom: var(--line-width) solid var(--line-faint);
  }

  .row {
    box-sizing: border-box;
    min-height: var(--target);
    padding: var(--space-2) var(--space-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    color: var(--ink);
    text-decoration: none;
  }

  a.row:hover {
    background: var(--paper);
  }

  a.row:focus-visible {
    outline-offset: -3px;
  }

  .text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-wrap: anywhere;
  }

  .title {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 700;
  }

  .sub {
    margin-top: 2px;
    font-size: var(--text-xs);
    color: var(--muted);
  }

  .mark {
    flex: none;
    font-family: var(--font-mono);
    color: var(--legit);
  }

  /* The open lesson: a card in the red frame of the attack, its steps unfolded. */
  .here {
    margin: var(--space-2);
    border: var(--frame-width) solid var(--attack);
    border-radius: var(--radius-xs);
    background: var(--attack-tint);
  }

  .list > li.here {
    border-bottom: var(--frame-width) solid var(--attack);
  }

  .here .row {
    border-bottom: var(--line-width) solid var(--attack-line);
  }

  .here .mark {
    color: var(--attack);
  }

  .steps {
    margin: 0;
    padding: var(--space-1) var(--space-2) var(--space-2);
    list-style: none;
    display: flex;
    flex-direction: column;
  }

  .step {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--target);
    padding: var(--space-1);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: 0;
    border-radius: var(--radius-xs);
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .step:hover {
    background: var(--panel);
  }

  .step-title {
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .future .step-title {
    color: var(--muted);
  }

  .now .step-title {
    color: var(--legit);
  }

  .dot {
    box-sizing: border-box;
    flex: none;
    width: var(--dot);
    height: var(--dot);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--scene-message-text);
    background: var(--scene-message-legit);
  }

  .dot.attack {
    background: var(--scene-message-attack);
  }

  .dot.safe,
  .dot.stopped {
    background: var(--scene-message-safe);
  }

  .future .dot {
    background: var(--muted);
  }

  .now .dot {
    outline: 2px solid var(--legit);
    outline-offset: 2px;
  }

  .soon .title {
    color: var(--muted);
    font-weight: 500;
  }
</style>
