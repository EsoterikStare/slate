import type { Preview } from '@storybook/web-components-vite';

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
