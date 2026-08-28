import { useEffect } from 'react';

const HA_THEME_VARIABLES = [
  '--primary-color',
  '--dark-primary-color',
  '--light-primary-color',
  '--accent-color',
  '--primary-background-color',
  '--secondary-background-color',
  '--card-background-color',
  '--ha-card-background',
  '--ha-card-border-color',
  '--ha-card-border-width',
  '--ha-card-border-radius',
  '--primary-text-color',
  '--text-primary-color',
  '--secondary-text-color',
  '--disabled-text-color',
  '--divider-color',
  '--border-color',
  '--table-row-background-color',
  '--table-row-alternative-background-color',
  '--input-fill-color',
  '--chip-background-color',
  '--ha-chip-background',
  '--sidebar-background-color',
  '--sidebar-icon-color',
  '--sidebar-text-color',
  '--app-header-background-color',
  '--app-header-text-color',
  '--error-color',
  '--warning-color',
  '--success-color',
  '--info-color',
  '--label-badge-background-color',
  '--label-badge-text-color',
  '--label-badge-red',
  '--label-badge-blue',
  '--label-badge-green',
  '--label-badge-yellow',
  '--paper-card-background-color',
  '--paper-dialog-background-color',
  '--paper-item-icon-color',
  '--paper-item-icon-active-color',
  '--state-icon-color',
  '--ha-color-primary',
  '--mdc-theme-primary',
  '--mdc-theme-secondary',
  '--mdc-theme-background',
  '--mdc-theme-surface',
  '--mdc-theme-on-primary',
  '--mdc-theme-on-secondary',
  '--mdc-theme-on-surface',
  '--mdc-text-field-fill-color',
];

/**
  * Custom hook to automatically detect, mirror, and synchronize Home Assistant
  * parent theme CSS variables into the app's iframe document root in real-time.
  */
export function useHomeAssistantTheme() {
  useEffect(() => {
    const syncTheme = () => {
      let targetWin: Window | null = null;

      // Safely access parent / top windows if embedded in Home Assistant iframe
      try {
        if (window.parent && window.parent !== window) {
          targetWin = window.parent;
        }
      } catch (e) {
        // Cross-origin access blocked
      }

      try {
        if (!targetWin && window.top && window.top !== window) {
          targetWin = window.top;
        }
      } catch (e) {
        // Cross-origin access blocked
      }

      if (!targetWin) return;

      let sourceDoc: Document | null = null;
      try {
        sourceDoc = targetWin.document;
      } catch (e) {
        // Cross-origin document access restriction
        return;
      }

      if (!sourceDoc) return;

      // Find the Home Assistant host element or root document
      const haElement =
        sourceDoc.querySelector('home-assistant') ||
        sourceDoc.querySelector('home-assistant-main') ||
        sourceDoc.querySelector('ha-panel-iframe') ||
        sourceDoc.documentElement;

      if (!haElement) return;

      const haComputed = targetWin.getComputedStyle(haElement);
      const rootComputed = targetWin.getComputedStyle(sourceDoc.documentElement);
      const bodyComputed = sourceDoc.body ? targetWin.getComputedStyle(sourceDoc.body) : null;

      const appRoot = document.documentElement;

      // Copy each Home Assistant CSS variable directly to local iframe root
      HA_THEME_VARIABLES.forEach((varName) => {
        const val =
          haComputed.getPropertyValue(varName)?.trim() ||
          rootComputed.getPropertyValue(varName)?.trim() ||
          bodyComputed?.getPropertyValue(varName)?.trim();

        if (val) {
          appRoot.style.setProperty(varName, val);
        }
      });

      // Synchronize light/dark class on app root if Home Assistant specifies theme mode
      const primaryBg =
        haComputed.getPropertyValue('--primary-background-color')?.trim() ||
        rootComputed.getPropertyValue('--primary-background-color')?.trim();

      if (primaryBg) {
        if (isLightColor(primaryBg)) {
          appRoot.classList.remove('dark');
          appRoot.classList.add('light');
        } else {
          appRoot.classList.remove('light');
          appRoot.classList.add('dark');
        }
      }
    };

    // Initial sync on mount
    syncTheme();

    // 1. Observe parent DOM mutations for instantaneous reaction to HA theme switches
    let observer: MutationObserver | null = null;
    try {
      const parentWin = window.parent !== window ? window.parent : window.top;
      if (parentWin && parentWin.document) {
        const targetNode = parentWin.document.documentElement;
        observer = new MutationObserver(() => {
          syncTheme();
        });
        observer.observe(targetNode, {
          attributes: true,
          attributeFilter: ['style', 'class', 'theme', 'data-theme'],
          subtree: true,
        });
      }
    } catch (e) {
      // Cross-origin observer restriction
    }

    // 2. Listen for postMessage theme events sent by HA custom panels or cards
    const handleMessage = (event: MessageEvent) => {
      if (event.data) {
        if (
          event.data.type === 'set-theme' ||
          event.data.type === 'hass-theme-changed' ||
          event.data.event === 'theme-changed' ||
          event.data.theme
        ) {
          syncTheme();
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // 3. Periodic fallback poll (1s interval) to catch subtle HA CSS changes
    const interval = setInterval(syncTheme, 1000);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);
}

/**
  * Utility function to determine if a CSS color string is light or dark
  */
function isLightColor(colorStr: string): boolean {
  if (!colorStr) return false;

  // Hex format #ffffff or #fff
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
  }

  // RGB / RGBA format rgb(255, 255, 255)
  if (colorStr.startsWith('rgb')) {
    const matches = colorStr.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0], 10);
      const g = parseInt(matches[1], 10);
      const b = parseInt(matches[2], 10);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
  }

  return false;
}
