// Bundle entry: HA loads dist/slate.js as a dashboard resource. Each
// card registers itself as a custom element when imported here.
import './cards/slate-calendar';
import './cards/slate-clock';
import './cards/slate-weather';
import './cards/slate-layout';

declare const __SLATE_VERSION__: string;
console.info(`%c SLATE %c ${__SLATE_VERSION__} `, 'background:#444;color:#fff', 'background:#ddd;color:#000');
