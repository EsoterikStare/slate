// Bundle entry: HA loads dist/wall-cards.js as a dashboard resource. Each
// card registers itself as a custom element when imported here.
import './cards/wall-calendar';
import './cards/wall-clock';
import './cards/wall-weather';
import './cards/wall-layout';

declare const __WALL_CARDS_VERSION__: string;
console.info(`%c WALL-CARDS %c ${__WALL_CARDS_VERSION__} `, 'background:#444;color:#fff', 'background:#ddd;color:#000');
