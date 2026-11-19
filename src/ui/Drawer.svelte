<script lang="ts">
  // The side panel (M2.1b, E2): a native modal <dialog> along the left edge with the tabs
  // «Уроки» and «Словарь»; a full-width sheet on a phone. The state says whether it is open and
  // on which tab (`drawer.open` / `drawer.close`); this component follows it. Esc, the close
  // button and a click outside close it; focus returns to the button that opened it. While it is
  // open the player takes no keys (`data-dialog-keys`) and the rest of the page is inert.
  import { tick } from 'svelte';
  import type { AppContext } from '../commands/app';
  import type { GlossaryLoader } from '../services/glossary/glossary';
  import type { Translate } from '../services/i18n/i18n';
  import { formatAddress } from '../services/router/address';
  import type { TopicsLoader } from '../services/topics/topics';
  import DrawerGlossary from './DrawerGlossary.svelte';
  import DrawerLessons from './DrawerLessons.svelte';
  import { setTermOpener } from './terms';

  const {
    app,
    topics,
    glossary,
    home,
    t,
    notFound,
    fallbackFocus,
  }: {
    app: AppContext;
    topics: TopicsLoader;
    glossary: GlossaryLoader;
    home: string;
    t: Translate;
    /** The address is no page of the site (M2.2): a lesson opens by loading its address. */
    notFound: boolean;
    /** Where focus goes on close when nothing on the page had it before (the «Уроки» button). */
    fallbackFocus: () => HTMLElement | null;
  } = $props();
  const uid = $props.id();
  const store = $derived(app.store);
  const tab = $derived($store.drawer);
  const run = (id: string, params?: Readonly<Record<string, unknown>>) => {
    app.registry.run(id, params);
  };

  let dialog = $state<HTMLDialogElement | null>(null);
  let lessons = $state<{ focusSearch(): void } | null>(null);
  let words = $state<{ focusSearch(): void } | null>(null);
  /**
   * The searches and the section filter live as long as the panel is open: a switch of tab keeps
   * them, closing the panel clears them (K114).
   */
  let lessonQuery = $state('');
  let lessonSection = $state('');
  let glossaryQuery = $state('');
  $effect(() => {
    if (tab !== null) return;
    lessonQuery = '';
    lessonSection = '';
    glossaryQuery = '';
  });

  /** The element that had focus before the panel opened; focus returns to it. */
  let returnTo: HTMLElement | null = null;
  const phone = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)');

  function focusInside(): void {
    void tick().then(() => {
      // On a phone the keyboard would cover the list: focus the tab, not the search field.
      if (phone !== false && phone.matches) {
        dialog?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
        return;
      }
      if ($store.drawer === 'glossary' && $store.glossary === null) words?.focusSearch();
      else if ($store.drawer === 'lessons') lessons?.focusSearch();
    });
  }

  // Open and close the dialog with the state.
  $effect(() => {
    const element = dialog;
    if (element === null) return;
    if (tab !== null && !element.open) {
      const active = document.activeElement;
      returnTo = active instanceof HTMLElement && active !== document.body ? active : null;
      element.showModal();
      focusInside();
    } else if (tab === null && element.open) {
      element.close();
    }
  });

  // The dialog closed by itself (Esc): the state follows. Focus returns either way.
  function onclose(): void {
    // The close event comes a moment later: the panel may have opened again since (a command
    // right after a close). That close is over.
    if (dialog?.open === true) return;
    if ($store.drawer !== null) run('drawer.close');
    const back = returnTo?.isConnected === true ? returnTo : fallbackFocus();
    returnTo = null;
    back?.focus();
  }

  // A press on the backdrop (the dialog element itself, outside its content) closes it.
  $effect(() => {
    const element = dialog;
    if (element === null) return;
    const onclick = (event: MouseEvent) => {
      if (event.target === element) run('drawer.close');
    };
    element.addEventListener('click', onclick);
    return () => {
      element.removeEventListener('click', onclick);
    };
  });

  // Inside the panel a glossary word opens its definition on the glossary tab, not in place.
  $effect(() => {
    if (tab === null) return;
    return setTermOpener((id) => {
      if ($store.drawer !== 'glossary') run('drawer.open', { tab: 'glossary' });
      run('glossary.open', { id });
    });
  });

  function openLesson(id: string): void {
    run('drawer.close');
    if (notFound) {
      // The router holds the state while the address is no page; the lesson's address is loaded
      // as a page, which the router reads as any address.
      const base = home.endsWith('/') ? home.slice(0, -1) : home;
      window.location.assign(
        `${base}${formatAddress({ lang: $store.locale, lesson: id, step: 1, defence: false })}`,
      );
      return;
    }
    run('lesson.open', { id });
  }

  /** ← and → move between the two tabs, as in any tab list. */
  function ontabkey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'lessons' ? 'glossary' : 'lessons';
    run('drawer.open', { tab: next });
    void tick().then(() => {
      document.getElementById(`${uid}-tab-${next}`)?.focus();
    });
  }
</script>

<dialog
  class="drawer"
  aria-labelledby="{uid}-title"
  data-testid="drawer"
  data-tab={tab}
  data-dialog-keys
  bind:this={dialog}
  {onclose}
>
  <div class="inner">
    <div class="head">
      <h2 class="visually-hidden" id="{uid}-title">{t('drawer.label')}</h2>
      <div class="tabs" role="tablist" aria-label={t('drawer.tabs')}>
        <button
          type="button"
          role="tab"
          id="{uid}-tab-lessons"
          aria-selected={tab === 'lessons'}
          aria-controls="{uid}-panel"
          tabindex={tab === 'lessons' ? 0 : -1}
          data-testid="drawer-tab-lessons"
          onkeydown={ontabkey}
          onclick={() => {
            run('drawer.open', { tab: 'lessons' });
          }}>{t('drawer.lessons')}</button
        >
        <button
          type="button"
          role="tab"
          id="{uid}-tab-glossary"
          aria-selected={tab === 'glossary'}
          aria-controls="{uid}-panel"
          tabindex={tab === 'glossary' ? 0 : -1}
          data-testid="drawer-tab-glossary"
          onkeydown={ontabkey}
          onclick={() => {
            run('drawer.open', { tab: 'glossary' });
          }}>{t('drawer.glossary')}</button
        >
      </div>
      <button
        type="button"
        class="close"
        aria-label={t('drawer.close')}
        data-testid="drawer-close"
        onclick={() => {
          run('drawer.close');
        }}>×</button
      >
    </div>
    <div
      class="body"
      role="tabpanel"
      id="{uid}-panel"
      aria-labelledby="{uid}-tab-{tab ?? 'lessons'}"
    >
      {#if tab === 'lessons'}
        <DrawerLessons
          bind:this={lessons}
          loader={topics}
          language={$store.locale}
          current={$store.lesson}
          bind:query={lessonQuery}
          bind:section={lessonSection}
          {home}
          {t}
          onopen={openLesson}
        />
      {:else if tab === 'glossary'}
        <DrawerGlossary
          bind:this={words}
          loader={glossary}
          language={$store.locale}
          open={$store.glossary}
          bind:query={glossaryQuery}
          {t}
          {run}
          onopen={openLesson}
        />
      {/if}
    </div>
  </div>
</dialog>

<style>
  /* Along the left edge, as tall as the window; the list scrolls inside it. */
  .drawer {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    inset: 0 auto 0 0;
    width: min(28rem, 100vw);
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border: 0;
    border-right: var(--line-width) solid var(--line);
    background: var(--panel);
    color: var(--ink);
    overflow: hidden;
  }

  .drawer::backdrop {
    background: var(--scrim);
  }

  .inner {
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) 0 var(--space-3);
    border-bottom: var(--line-width) solid var(--line);
  }

  .tabs {
    flex: 1 1 auto;
    display: flex;
    gap: var(--space-1);
    min-width: 0;
  }

  [role='tab'] {
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 700;
    cursor: pointer;
  }

  [role='tab'][aria-selected='true'] {
    border-bottom-color: var(--legit);
    color: var(--ink);
  }

  [role='tab']:focus-visible,
  .close:focus-visible {
    outline: 2px solid var(--legit);
    outline-offset: -2px;
  }

  .close {
    flex: none;
    min-width: 44px;
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: var(--text-xl);
    line-height: 1;
    cursor: pointer;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--space-3);
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

  /* Phone (S10): the whole width of the screen. */
  @media (max-width: 760px) {
    .drawer {
      width: 100vw;
      border-right: 0;
    }
  }
</style>
