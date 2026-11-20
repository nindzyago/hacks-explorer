<script lang="ts">
  // The explanation panel (M1.4, S3): the current step at three depths, the lesson passport,
  // «Как защититься» and the sources. The tabs run `depth.set` by id (K13), like the control
  // channel. Arrows inside the tabs move between them; the player ignores arrows there (K69).
  import { tick } from 'svelte';
  import type { SiteLesson, SiteStep } from '../core/lesson/site';
  import type { Depth } from '../core/state';
  import type { Translate } from '../services/i18n/i18n';
  import CodeBox from './CodeBox.svelte';
  import {
    codeAtDeep,
    DEPTH_TABS,
    levelText,
    passportRows,
    severityWord,
    tabAfterKey,
  } from './explain';
  import RichBlocks from './RichBlocks.svelte';

  const {
    lesson,
    current,
    depth,
    run,
    t,
  }: {
    lesson: SiteLesson;
    current: { readonly number: number; readonly count: number; readonly step: SiteStep } | null;
    depth: Depth;
    run: (id: string, params?: Readonly<Record<string, unknown>>) => void;
    t: Translate;
  } = $props();

  const tabs: Partial<Record<Depth, HTMLButtonElement>> = $state({});
  const rows = $derived(passportRows(lesson.passport, t));
  const codes = $derived(
    current !== null && depth === 'deep' ? codeAtDeep(lesson.steps, current.step, t) : [],
  );

  /*
   * K73: on a wide screen the panel scrolls inside the top row. While there is more below, a
   * still hint «Ниже ещё ↓» sits at its bottom edge (no animation). Measured on scroll and on
   * any change of size of the panel or of its content (a new step, depth or lesson).
   */
  let panel: HTMLElement | undefined = $state();
  let content: HTMLElement | undefined = $state();
  let more = $state(false);

  function measure(): void {
    if (panel === undefined) return;
    more = panel.scrollHeight - panel.scrollTop - panel.clientHeight > 2;
  }

  $effect(() => {
    const element = panel;
    const inner = content;
    if (element === undefined || inner === undefined) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(inner);
    return () => {
      observer.disconnect();
    };
  });

  async function onkeydown(event: KeyboardEvent, from: Depth): Promise<void> {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const next = tabAfterKey(from, event.key);
    if (next === null) return;
    event.preventDefault();
    run('depth.set', { depth: next });
    await tick();
    tabs[next]?.focus();
  }
</script>

<!--
  On a wide screen the panel scrolls inside the top row (K73): it takes focus, and Space and the
  arrows scroll it there instead of driving the player (`data-own-keys`, K69).
-->
<!-- M6.1: the panel «Объяснение» in the blueprint frame; its body scrolls, the head stays. -->
<div class="bp-panel frame">
  <div class="bp-head"><h2 id="explain-title" class="bp-title">{t('explain.title')}</h2></div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <section
    class="panel explain"
    data-testid="explain"
    data-own-keys
    aria-labelledby="explain-title"
    tabindex="0"
    bind:this={panel}
    onscroll={measure}
  >
    <div class="content" bind:this={content}>
      <div class="lesson-head">
        <h2 class="lesson-title" id="lesson-title" data-testid="lesson-title">{lesson.title}</h2>
        {#if lesson.passport.severity !== null}
          <span
            class="severity {lesson.passport.severity}"
            data-testid="lesson-severity"
            title={t('passport.severity')}>{severityWord(lesson.passport.severity, t)}</span
          >
        {/if}
      </div>

      <div class="tabs" role="tablist" aria-label={t('explain.depths')} data-testid="depth-tabs">
        {#each DEPTH_TABS as tab (tab.depth)}
          <button
            type="button"
            role="tab"
            id="depth-tab-{tab.depth}"
            data-testid="depth-{tab.depth}"
            aria-selected={tab.depth === depth}
            aria-controls="explain-text"
            tabindex={tab.depth === depth ? 0 : -1}
            bind:this={tabs[tab.depth]}
            onclick={() => {
              run('depth.set', { depth: tab.depth });
            }}
            onkeydown={(event) => void onkeydown(event, tab.depth)}>{t(tab.label)}</button
          >
        {/each}
      </div>

      <div
        class="text"
        id="explain-text"
        role="tabpanel"
        aria-labelledby="depth-tab-{depth}"
        data-testid="explain-text"
        data-depth={depth}
      >
        {#if current !== null}
          <p class="step" data-testid="explain-step">
            {t('explain.step', {
              number: current.number,
              count: current.count,
              title: current.step.title,
            })}
          </p>
          <!-- At «Глубже» the code comes first: the query is in view without scrolling (K73). -->
          {#each codes as shown, i (i)}
            <CodeBox code={shown.code} label={shown.label} current={shown.current} {t} />
          {/each}
          <RichBlocks blocks={levelText(current.step, depth)} {t} />
        {:else}
          <p class="muted">{t('lesson.noSteps')}</p>
        {/if}
      </div>

      {#if rows.length > 0}
        <section class="part" aria-labelledby="passport-title">
          <h3 id="passport-title">{t('explain.passport')}</h3>
          <dl class="passport" data-testid="passport">
            {#each rows as row (row.key)}
              <div class="row" data-key={row.key}>
                <dt>{row.label}</dt>
                <dd>
                  {row.value}
                  {#if row.detail !== undefined}
                    <span class="detail">{row.detail}</span>
                  {/if}
                </dd>
              </div>
            {/each}
          </dl>
        </section>
      {/if}

      {#if lesson.defence !== null}
        <section class="part" aria-labelledby="defence-title" data-testid="explain-defence">
          <h3 id="defence-title">{t('explain.defence')}</h3>
          <RichBlocks blocks={lesson.defence} {t} />
        </section>
      {/if}

      {#if lesson.sources.length > 0}
        <section class="part" aria-labelledby="sources-title" data-testid="sources">
          <h3 id="sources-title">{t('explain.sources')}</h3>
          <ul class="sources">
            {#each lesson.sources as source, i (i)}
              <li>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="source-link-{i + 1}">{source.title}</a
                >
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
    {#if more}
      <p class="more" data-testid="explain-more" aria-hidden="true">{t('explain.more')}</p>
    {/if}
  </section>
</div>

<style>
  /* M6.1: the frame fills its cell of the screen; the body scrolls inside it (K73). */
  .frame {
    height: 100%;
  }

  .panel {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    font-size: var(--text-sm);
    line-height: var(--leading);
    overflow-y: auto;
    overscroll-behavior: contain;
    /* A long word or a link in lesson text breaks instead of pushing the page sideways. */
    overflow-wrap: anywhere;
  }

  .panel:focus-visible {
    outline-offset: -3px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .lesson-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .lesson-title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--legit);
  }

  /* The severity of the passport: a pill, red when high or critical. */
  .severity {
    flex: none;
    padding: 2px var(--space-2);
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border: var(--frame-width) solid currentcolor;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--legit);
  }

  .severity::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentcolor;
  }

  .severity.high,
  .severity.critical {
    color: var(--attack);
  }

  .more {
    position: sticky;
    bottom: calc(-1 * var(--space-3));
    margin: var(--space-3) calc(-1 * var(--space-3)) calc(-1 * var(--space-3));
    padding: var(--space-6) var(--space-3) var(--space-2);
    background: linear-gradient(to bottom, transparent, var(--panel) 55%);
    color: var(--muted);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-align: center;
    pointer-events: none;
  }

  h3 {
    margin: 0;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--caps-spacing);
    color: var(--legit);
  }

  /* «Просто / По шагам / Глубже»: one blue segmented bar (M6.1). */
  .tabs {
    display: flex;
    border: var(--frame-width) solid var(--frame);
    border-radius: var(--radius-xs);
  }

  .tabs button:first-child {
    border-radius: calc(var(--radius-xs) - var(--frame-width)) 0 0
      calc(var(--radius-xs) - var(--frame-width));
  }

  .tabs button:last-child {
    border-radius: 0 calc(var(--radius-xs) - var(--frame-width))
      calc(var(--radius-xs) - var(--frame-width)) 0;
  }

  .tabs button {
    flex: 1 1 0;
    min-width: 0;
    min-height: var(--target);
    padding: 0 var(--space-1);
    border: none;
    background: var(--panel);
    color: var(--legit);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    overflow-wrap: normal;
    cursor: pointer;
  }

  .tabs button + button {
    border-left: var(--frame-width) solid var(--frame);
  }

  .tabs button:hover {
    background: var(--paper);
  }

  .tabs button[aria-selected='true'] {
    background: var(--legit);
    color: var(--panel);
  }

  .tabs button:focus-visible {
    position: relative;
    z-index: 1;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--text-md);
  }

  .step {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .muted {
    margin: 0;
    color: var(--muted);
    font-size: var(--text-sm);
  }

  .part {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: var(--line-width) solid var(--line-faint);
    min-width: 0;
  }

  /* The passport as a key-value table (M6.1). */
  .passport {
    margin: 0;
    display: flex;
    flex-direction: column;
    font-size: var(--text-sm);
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 7rem) minmax(0, 1fr);
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-bottom: var(--line-width) solid var(--line-faint);
  }

  dt {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  /* M2.5: the CVSS vector under its score. */
  .detail {
    display: block;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .sources {
    margin: 0;
    padding-left: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }

  /* M2.7: a target of at least 24 px (WCAG 2.2, 2.5.8) — a line of text is about 19 px. */
  .sources a {
    display: inline-block;
    min-block-size: var(--space-6);
    padding-block: var(--space-1);
    color: var(--legit);
    overflow-wrap: anywhere;
  }

  /* Phone (S10): a plain block in the page, which scrolls. */
  @media (max-width: 760px) {
    .panel {
      overflow-y: visible;
    }
  }
</style>
