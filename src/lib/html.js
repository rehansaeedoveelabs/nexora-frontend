import { createElement } from 'react';
import htm from 'htm';

/**
 * JSX without a compiler. Write markup in a tagged template:
 *
 *   html`<s-button onClick=${save}>Save</s-button>`
 *   html`<${Locations} tab=${tab} />`        ← React components go inside ${}
 *
 * htm turns it into React.createElement calls at runtime (~1KB, no build step).
 */
export const html = htm.bind(createElement);
