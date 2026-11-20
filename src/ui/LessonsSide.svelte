<script lang="ts">
  // The left column of the lesson screen on a wide window (M6.1, design §2): the panel «Уроки»
  // with the tab «Словарь», always open, not a dialog. UI2: the lessons tab starts with a row of
  // chips — «Все» and one per section, by its short name — and lists the topics grouped by
  // section under a heading with «готово N из M»; within a section the ready lessons come first,
  // the topics still being written after them, grey with «скоро». The open lesson is unfolded with
  // its steps — a circle in the colour of the step, the current one outlined; a step runs
  // `player.goto`, another lesson `lesson.open`. The search of the top bar filters this list. The
  // glossary tab is the glossary of the side panel (M2.1b): while it shows, a glossary word on the
  // page opens its definition here, not in place.
  import { tick } from 'svelte';
  import type { SiteLesson } from '../core/lesson/site';
  import { stepsInMode } from '../core/scene-layout/message';
  import type { SiteTopicSection } from '../core/topics/site';
  import { sideGroups } from '../core/topics/search';
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
    tab?: 'lessons' | 'glossary';
  } = $props();
  const uid = $props.id();

  /** The section chosen by its chip; '' is «Все». */
  let section = $state('');
  let glossaryQuery = $state('');
  const groups = $derived(
    sideGroups(sections, { query, section: section === '' ? null : section }),
  );
  /** The section of the open lesson: its chip is framed. */
  const hereSection = $derived(current.slice(0, 1));
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
  // the column scrolls, never the page. The chips stand above the scrolling list, outside it: a
  // row that scrolled half under sticky chips was a link too small to hit (axe target-size, seen
  // once the column held 29 lessons). UI2: the open lesson may stand below whole sections now, so where the
  // column stops depends on the size of its rows; it is measured once the fonts are in (the
  // screenshots of a reload are the same byte for byte).
  let body = $state<HTMLElement | null>(null);
  $effect(() => {
    const element = body;
    if (element === null || tab !== 'lessons' || groups.length === 0) return;
    if (current === '' || steps.length === 0) return;
    let live = true;
    void tick()
      .then(() => {
        // Lays the column out, so the fonts it needs are asked for before waiting for them.
        element.getBoundingClientRect();
        return document.fonts.ready;
      })
      .then(() => {
        const here = element.querySelector<HTMLElement>('li.here');
        if (!live || here === null) return;
        const top = here.offsetTop;
        const bottom = top + here.offsetHeight;
        if (top < element.scrollTop) element.scrollTop = Math.max(0, top);
        else if (bottom > element.scrollTop + element.clientHeight)
          element.scrollTop = Math.max(0, bottom - element.clientHeight);
      });
    return () => {
      live = false;
    };
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
  <div class="body" role="tabpanel" id="{uid}-panel" aria-labelledby="{uid}-tab-{tab}">
    {#if tab !== 'glossary' && status === 'ready'}
      <div class="chips" role="group" aria-label={t('screen.sections')} data-testid="side-sections">
        <button
          type="button"
          class="bp-chip"
          aria-pressed={section === ''}
          data-testid="side-section-all"
          onclick={() => {
            section = '';
          }}>{t('screen.sectionsAll')}</button
        >
        {#each sections as s (s.id)}
          <button
            type="button"
            class="bp-chip"
            class:own={s.id === hereSection}
            aria-pressed={section === s.id}
            title="{s.id}. {s.title}"
            data-testid="side-section-{s.id}"
            onclick={() => {
              section = s.id;
            }}>{s.short}</button
          >
        {/each}
      </div>
    {/if}
    <div class="scroll" bind:this={body}>
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
        {#if groups.length === 0}
          <p class="note" data-testid="side-empty">{t('catalog.empty')}</p>
        {:else}
          <div class="list" data-testid="side-list">
            {#each groups as g (g.section.id)}
              <section
                class="group"
                aria-labelledby="{uid}-section-{g.section.id}"
                data-testid="side-group"
                data-section={g.section.id}
              >
                <div class="group-head">
                  <h3 id="{uid}-section-{g.section.id}">
                    <span class="sid">{g.section.id}</span>
                    {g.section.title}
                  </h3>
                  <span class="count" data-testid="side-count"
                    >{t('catalog.ready', { ready: g.readyCount, count: g.count })}</span
                  >
                </div>
                <ul>
                  {#each g.ready as topic (topic.id)}
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
                          {#each steps as st, i (i)}
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
                                <span class="dot {paint(st)}" aria-hidden="true">{n}</span>
                                <span class="step-title">{st.title}</span>
                              </button>
                            </li>
                          {/each}
                        </ol>
                      {/if}
                    </li>
                  {/each}
                  {#each g.soon as topic (topic.id)}
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
              </section>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
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
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }

  .scroll {
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

  /* UI2: the chips stay at the top of the column; the list scrolls below them, not under them. */
  .chips {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--line-width) solid var(--line);
    background: var(--panel);
  }

  .chips .own {
    border-color: var(--legit);
    font-weight: 700;
  }

  .group ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .group ul > li {
    border-bottom: var(--line-width) solid var(--line-faint);
  }

  .group-head {
    padding: var(--space-3) var(--space-3) var(--space-1);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    border-bottom: var(--line-width) solid var(--line-faint);
  }

  .group-head h3 {
    margin: 0;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--legit);
    overflow-wrap: anywhere;
  }

  .sid {
    margin-right: var(--space-1);
  }

  .count {
    flex: none;
    font-size: var(--text-xs);
    color: var(--muted);
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

  .group ul > li.here {
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
