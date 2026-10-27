import { PassThrough, Readable } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';

/**
 * Build-time only. In SPA mode (`ssr: false`) React Router runs this once during `npm run build`
 * to write the static index.html from root.jsx. It never runs in production; there is no Node server.
 *
 * Must use React's streaming renderer: <ServerRouter> streams its hydration data and only emits the
 * closing script when the stream finishes. `renderToString` never finishes it, and the app then
 * hangs on the loading spinner. `onAllReady` waits for everything, since nothing is streamed live.
 */
export default function handleRequest(request, status, headers, routerContext) {
  return new Promise((resolve, reject) => {
    let responseStatus = status;

    const { pipe } = renderToPipeableStream(<ServerRouter context={routerContext} url={request.url} />, {
      onAllReady() {
        const body = new PassThrough();
        headers.set('Content-Type', 'text/html; charset=utf-8');
        resolve(new Response(Readable.toWeb(body), { status: responseStatus, headers }));
        pipe(body);
      },
      onShellError: reject,
      onError(error) {
        responseStatus = 500;
        console.error(error);
      },
    });
  });
}
