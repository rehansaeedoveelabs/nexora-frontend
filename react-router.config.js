/** @type {import('@react-router/dev/config').Config} */
export default {
  // SPA mode: `npm run build` outputs static files only (build/client). No Node server in production;
  // the Laravel backend is the only server.
  ssr: false,
  appDirectory: 'app',
  // E2E tests build into a separate folder so they never overwrite a real build.
  buildDirectory: process.env.NEXORA_BUILD_DIR ?? 'build',
};
