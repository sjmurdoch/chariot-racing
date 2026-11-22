// Full screen and landscape.
//
// Where the browser allows it (Android, desktop, iPad), the start tap enters
// full screen and locks the screen to landscape. iPhone Safari supports
// neither, so there the game runs full screen when added to the Home Screen,
// and a "rotate your phone" screen pauses the race whenever it's held upright.

/** Whether this looks like a phone or tablet, where portrait needs a rotate prompt. */
export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** Whether a touch device is currently held upright. */
export function isPortraitTouch(): boolean {
  return isTouchDevice() && window.innerHeight > window.innerWidth;
}

/** Whether the game is running as a Home Screen app rather than in a browser tab. */
export function isInstalled(): boolean {
  return (
    (navigator as { standalone?: boolean }).standalone === true ||
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches
  );
}

/**
 * The full screen height, in CSS pixels, for the current orientation. iOS
 * reports screen.width and screen.height for portrait whichever way the
 * phone is held, so pick by the window's shape.
 */
export function screenHeightFor(
  screenWidth: number,
  screenHeight: number,
  landscape: boolean,
): number {
  return landscape ? Math.min(screenWidth, screenHeight) : Math.max(screenWidth, screenHeight);
}

/**
 * In a Home Screen app, makes the page as tall as the screen. iOS 26 gives
 * such apps a viewport shorter than the screen (WebKit bug 301108), which
 * would leave a strip at the bottom without the game in it.
 */
export function fitInstalledViewport(): void {
  if (!isInstalled()) return;
  const root = document.documentElement;
  root.classList.add('installed');
  const update = () => {
    const landscape = window.innerWidth > window.innerHeight;
    const height = Math.max(
      window.innerHeight,
      screenHeightFor(screen.width, screen.height, landscape),
    );
    root.style.setProperty('--app-height', `${height}px`);
  };
  window.addEventListener('resize', update);
  screen.orientation?.addEventListener?.('change', update);
  update();
}

/** How the page is shown: in a browser tab or as a Home Screen app, and whether full screen. */
export function displayMode(): string {
  const mode = isInstalled() ? 'home screen app' : 'browser';
  return document.fullscreenElement ? `${mode}, full screen` : mode;
}

/** The safe-area insets (notch, home indicator) in CSS pixels: top, right, bottom, left. */
export function safeAreaInsets(): [number, number, number, number] {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
    'env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets: [number, number, number, number] = [
    parseFloat(style.paddingTop) || 0,
    parseFloat(style.paddingRight) || 0,
    parseFloat(style.paddingBottom) || 0,
    parseFloat(style.paddingLeft) || 0,
  ];
  probe.remove();
  return insets;
}

/** Whether this is an iPhone or iPod, where only the Home Screen gives full screen. */
export function isIPhone(userAgent = navigator.userAgent): boolean {
  return /\b(iPhone|iPod)\b/.test(userAgent);
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

/**
 * Asks for full screen, then for a landscape lock. Call from inside a tap or
 * key press. Both are best effort: unsupported browsers just carry on.
 */
export function enterFullscreenLandscape(): void {
  const root = document.documentElement as FullscreenElement;
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
  if (!request || document.fullscreenElement) {
    lockLandscape();
    return;
  }
  try {
    Promise.resolve(request.call(root, { navigationUI: 'hide' }))
      .then(lockLandscape)
      .catch((error: unknown) => console.debug('full screen unavailable: %s', error));
  } catch (error) {
    console.debug('full screen unavailable: %s', error);
  }
}

function lockLandscape(): void {
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation?.lock) return;
  orientation
    .lock('landscape')
    .catch((error: unknown) => console.debug('landscape lock unavailable: %s', error));
}

/**
 * Shows the rotate prompt whenever a touch device is upright, and calls
 * `onChange` with whether play should be paused.
 */
export function watchOrientation(prompt: HTMLElement, onChange: (paused: boolean) => void): void {
  let paused: boolean | undefined;
  const update = () => {
    const portrait = isPortraitTouch();
    prompt.hidden = !portrait;
    if (portrait !== paused) {
      paused = portrait;
      onChange(portrait);
    }
  };
  window.addEventListener('resize', update);
  screen.orientation?.addEventListener?.('change', update);
  update();
}
