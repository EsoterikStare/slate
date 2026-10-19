import type { Preview } from '@storybook/web-components-vite';
// HA's frontend uses Roboto; load it so optical details (centring, wrapping,
// measured heights) look in Storybook the way they will on the kiosk.
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: { options: { dark: { name: 'Dark', value: '#111' } } },
    viewport: {
      options: {
        kiosk: {
          name: 'Kiosk portrait 1080×1920',
          styles: { width: '1080px', height: '1920px' },
          type: 'desktop',
        },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
};

export default preview;
