<script lang="ts">
  // The definition of a glossary term, in place (M2.4, K7): next to the word, icon or zone the
  // reader pressed on a wide screen, a sheet at the bottom on a phone. One at a time: the state
  // holds the open term (`glossary.open` / `glossary.close`). «См. также» opens the next
  // definition in the same place; a related lesson opens the lesson. Esc, the close button, a
  // click elsewhere or focus leaving it close it; Esc and the button return focus to the word.
  // The glossary index is loaded the first time a term opens, a term's definition with its chunk.
  //
  // Positions are set as CSS custom properties through the CSSOM: the page's CSP forbids style
  // attributes, not that.
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import type { AppContext } from '../commands/app';
  import type { GlossaryLoader, GlossaryView } from '../services/glossary/glossary';
  import type { Translate } from '../services/i18n/i18n';
  import RichBlocks from './RichBlocks.svelte';
  import { openTerm, setTermOpener } from './terms';

  const {
    app,
    loader,
    language,
    t,
  }: { app: AppContext; loader: GlossaryLoader; language: string; t: Translate } = $props();
  const uid = $props.id();
  const store = $derived(app.store);
  const open = $derived($store.glossary);
  const run = (id: string, params?: Readonly<Record<string, unknown>>) => {
    app.registry.run(id, params);
  };

  type Data =
    | { readonly state: 'loading' }
    | { readonly state: 'ready'; readonly view: GlossaryView }
    | { readonly state: 'error' };
  let data = $state.raw<Data>({ state: 'loading' });
  let attempt = $state(0);
  // `bind:this` sets null when the popover closes.
  let box = $state<HTMLElement | null>(null);
  /** The element the reader pressed; focus returns to it. Not reactive: placing reads it. */
  let anchor: Element | null = null;
  const phone = new MediaQuery('max-width: 760px', false);

  const view = $derived(data.state === 'ready' ? data.view : null);
  const term = $derived(view?.term ?? undefined);
  const titles = $derived(new Map(view?.glossary.terms.map((t) => [t.id, t.title]) ?? []));
  const category = $derived(
    view !== null && term !== undefined
      ? view.glossary.categories.find((c) => c.id === term.category)?.label
      : undefined,
  );

  $effect(() =>
    setTermOpener((id, element) => {
      // «См. также» inside the definition keeps the first anchor: focus goes back to the text.
      if (element === null || box === null || !box.contains(element)) anchor = element;
      run('glossary.open', { id });
    }),
  );

  // Load the glossary index of the page's language the first time a term opens, and the chunk
  // with each term's definition the first time that term (or one of its chunk) opens (CI3). A term
  // already here shows at once, without a loading step.
  $effect(() => {
    // `attempt` is read so «Попробовать снова» runs this again.
    const id = open;
    const lang = language;
    if (id === null || attempt < 0) return;
    const known = loader.known(lang, id);
    if (known !== undefined) {
      data = { state: 'ready', view: known };
      return;
    }
    let current = true;
    data = { state: 'loading' };
    void loader.term(lang, id).then(
      (result) => {
        if (current) data = result.ok ? { state: 'ready', view: result.value } : { state: 'error' };
      },
      () => {
        if (current) data = { state: 'error' };
      },
    );
    return () => {
      current = false;
    };
  });

  function place(): void {
    const element = box;
    if (element === null) return;
    if (phone.current) {
      element.style.removeProperty('--pop-left');
      element.style.removeProperty('--pop-top');
      return;
    }
    const at = anchor?.isConnected === true ? anchor.getBoundingClientRect() : null;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = element.offsetWidth;
    const h = element.offsetHeight;
    const margin = 12;
    const left = Math.max(
      margin,
      Math.min(at === null ? (vw - w) / 2 : at.left + at.width / 2 - w / 2, vw - w - margin),
    );
    let top = at === null ? vh * 0.15 : at.bottom + 8;
    if (at !== null && top + h > vh - 8) {
      top = at.top - 8 - h > 8 ? at.top - 8 - h : Math.max(8, vh - 8 - h);
    }
    element.style.setProperty('--pop-left', `${String(Math.round(left))}px`);
    element.style.setProperty('--pop-top', `${String(Math.round(top))}px`);
  }

  // Place it, focus it, and follow the page while it is open.
  $effect(() => {
    const element = box;
    // `phone.current` is read so turning a tablet over places it again.
    if (element === null || open === null || typeof phone.current !== 'boolean') return;
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  });

  // A new term (opened or switched by «см. также»): focus moves into the definition.
  $effect(() => {
    if (open === null) return;
    void tick().then(() => {
      box?.focus({ preventScroll: true });
    });
  });

  function close(refocus: boolean): void {
    const back = anchor;
    anchor = null;
    run('glossary.close');
    if (
      refocus &&
      back?.isConnected === true &&
      (back instanceof HTMLElement || back instanceof SVGElement)
    ) {
      back.focus({ preventScroll: true });
    }
  }

  // A press anywhere else closes it; a press on another term opens that one instead.
  $effect(() => {
    if (open === null) return;
    const onpointerdown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (box?.contains(target) === true || target.closest('[data-term]') !== null) return;
      close(false);
    };
    window.addEventListener('pointerdown', onpointerdown, true);
    return () => {
      window.removeEventListener('pointerdown', onpointerdown, true);
    };
  });

  function onkeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close(true);
  }

  function onfocusout(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && box !== null && !box.contains(next)) close(false);
  }
</script>

{#if open !== null}
  <div
    class="pop"
    role="dialog"
    aria-labelledby="{uid}-title"
    tabindex="-1"
    data-testid="glossary-popover"
    data-term={open}
    data-state={data.state === 'ready' && term === undefined ? 'unknown' : data.state}
    data-dialog-keys
    bind:this={box}
    {onkeydown}
    {onfocusout}
  >
    <div class="head">
      <div class="names">
        {#if category !== undefined}<span class="tag">{category}</span>{/if}
        <h2 id="{uid}-title" data-testid="glossary-title">{term?.title ?? t('glossary.title')}</h2>
      </div>
      <button
        type="button"
        class="close"
        aria-label={t('glossary.close')}
        data-testid="glossary-close"
        onclick={() => {
          close(true);
        }}>×</button
      >
    </div>

    {#if data.state === 'loading'}
      <p class="note" role="status">{t('glossary.loading')}</p>
    {:else if data.state === 'error'}
      <p class="note" role="alert">{t('glossary.error')}</p>
      <button
        type="button"
        class="chip"
        data-testid="glossary-retry"
        onclick={() => {
          attempt += 1;
        }}>{t('lesson.retry')}</button
      >
    {:else if term === undefined}
      <p class="note">{t('glossary.unknown')}</p>
    {:else}
      <div class="definition" data-testid="glossary-definition">
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
                data-testid="glossary-see"
                data-term={id}
                onclick={(event) => {
                  openTerm(id, event.currentTarget);
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
                data-testid="glossary-lesson"
                data-lesson={lesson.id}
                onclick={() => {
                  close(false);
                  run('lesson.open', { id: lesson.id });
                }}>{lesson.title}</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .pop {
    box-sizing: border-box;
    position: fixed;
    z-index: 20;
    left: var(--pop-left, var(--space-4));
    top: var(--pop-top, var(--space-4));
    width: min(24rem, calc(100vw - 24px));
    max-height: min(70vh, 34rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-3) var(--space-4) var(--space-4);
    background: var(--panel);
    color: var(--ink);
    border: 2px solid var(--muted);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }

  /* Phone: a sheet along the bottom edge, never wider than the screen (S10). */
  @media (max-width: 760px) {
    .pop {
      left: var(--space-3);
      right: var(--space-3);
      top: auto;
      bottom: var(--space-3);
      width: auto;
      max-height: 60vh;
    }
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .names {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .tag {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  h2 {
    margin: 0;
    font-size: var(--text-lg);
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .close {
    flex: none;
    min-width: 44px;
    min-height: 44px;
    margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-3)) 0 0;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: var(--text-xl);
    line-height: 1;
    cursor: pointer;
  }

  .note {
    margin: 0;
    color: var(--muted);
  }

  .definition {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .label {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
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
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  .chip.lesson {
    background: var(--legit);
    color: var(--panel);
  }
</style>
