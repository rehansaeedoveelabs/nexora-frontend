import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { html } from './lib/html.js';
import { App } from './App.js';

createRoot(document.getElementById('app')).render(html`
  <${StrictMode}>
    <${BrowserRouter}>
      <${App} />
    <//>
  <//>
`);
