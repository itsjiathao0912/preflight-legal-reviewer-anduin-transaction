import { createApp, type Env } from './app';

const app = createApp({ fetch: (input, init) => fetch(input, init), now: () => Date.now() });

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
