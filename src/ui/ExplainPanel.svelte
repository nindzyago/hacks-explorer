<script lang="ts">
  // The explanation panel (M1.4, S3): the current step at three depths, the lesson passport,
  // «Как защититься» and the sources. The tabs run `depth.set` by id (K13), like the control
  // channel. Arrows inside the tabs move between them; the player ignores arrows there (K69).
  import { tick } from 'svelte';
  import type { SiteLesson, SiteStep } from '../core/lesson/site';
  import type { Depth } from '../core/state';
  import type { Translate } from '../services/i18n/i18n';
  import CodeBox from './CodeBox.svelte';
  import { codeAtDeep, DEPTH_TABS, levelText, passportRows, tabAfterKey } from './explain';
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
    <h2 id="explain-title" class="visually-hidden">{t('explain.title')}</h2>

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

<style>
  .panel {
    box-sizing: border-box;
    min-width: 0;
    padding: var(--space-3);
    background: var(--panel);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    font-size: var(--text-md);
    line-height: var(--leading);
    /* A long word or a link in lesson text breaks instead of pushing the page sideways. */
    overflow-wrap: anywhere;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
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

  h2,
  h3 {
    margin: 0;
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  .tabs {
    display: flex;
    border-bottom: var(--line-width) solid var(--line);
  }

  .tabs button {
    flex: 1 1 0;
    min-width: 0;
    min-height: 44px;
    padding: 0 var(--space-2);
    border: none;
    border-bottom: 3px solid transparent;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
  }

  .tabs button[aria-selected='true'] {
    color: var(--ink);
    font-weight: 700;
    border-bottom-color: var(--ink);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .step {
    margin: 0;
    font-weight: 700;
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
    border-top: var(--line-width) solid var(--line);
    min-width: 0;
  }

  .passport {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
    gap: var(--space-2);
  }

  dt {
    color: var(--muted);
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
</style>
