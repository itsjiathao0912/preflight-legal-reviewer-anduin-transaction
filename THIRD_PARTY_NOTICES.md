# Third-Party Notices

Direct dependencies of this workspace and their licenses (checked against the npm registry on 2026-10-17).
Project rule: only MIT / BSD / Apache-2.0 / ISC code (fonts: OFL). Keep upstream notices when copying code.

| Package                                     | Version                   | License           | Used in                                    |
| ------------------------------------------- | ------------------------- | ----------------- | ------------------------------------------ |
| react, react-dom                            | 19.3.1                    | MIT               | @aduin/web                                 |
| @radix-ui/react-slot                        | 1.5.0                     | MIT               | @aduin/web                                 |
| @tanstack/react-table                       | 9.3.1                     | MIT               | @aduin/web                                 |
| zustand                                     | 5.0.15                    | MIT               | @aduin/web                                 |
| dexie                                       | 4.4.6                     | Apache-2.0        | @aduin/web                                 |
| comlink                                     | 4.4.2                     | Apache-2.0        | @aduin/web                                 |
| docx                                        | 9.11.0                    | MIT               | @aduin/web                                 |
| pdfjs-dist                                  | 6.4.299                   | Apache-2.0        | @aduin/web, @aduin/scripts (dev)           |
| htmlparser2                                 | 12.0.0                    | MIT               | @aduin/core, @aduin/scripts                |
| unpdf                                       | 1.9.0                     | MIT               | @aduin/core                                |
| mammoth                                     | 1.13.0                    | BSD-2-Clause      | @aduin/core                                |
| diff (jsdiff)                               | 9.0.0                     | BSD-3-Clause      | @aduin/core                                |
| zod                                         | 4.6.7                     | MIT               | @aduin/core, @aduin/worker, @aduin/scripts |
| @noble/hashes                               | 2.4.0                     | MIT               | @aduin/core, @aduin/worker, @aduin/scripts |
| vite                                        | 8.3.4                     | MIT               | dev                                        |
| @vitejs/plugin-react                        | 6.1.2                     | MIT               | dev                                        |
| tailwindcss, @tailwindcss/vite              | 4.3.3                     | MIT               | dev                                        |
| vitest                                      | 4.1.12                    | MIT               | dev                                        |
| fast-check                                  | 4.10.2                    | MIT               | dev                                        |
| @cloudflare/vitest-plugin                   | 1.4.4                     | MIT               | dev                                        |
| @cloudflare/workers-types                   | 5.20261016.1              | MIT OR Apache-2.0 | dev                                        |
| wrangler                                    | 4.151.1                   | MIT OR Apache-2.0 | dev                                        |
| @playwright/test                            | 1.64.1                    | Apache-2.0        | dev                                        |
| jsdom                                       | 30.1.3                    | MIT               | dev                                        |
| typescript                                  | 6.0.3                     | Apache-2.0        | dev                                        |
| typescript-eslint                           | 8.71.2                    | MIT               | dev                                        |
| eslint, @eslint/js                          | 10.13.0 / 10.0.1          | MIT               | dev                                        |
| globals                                     | 17.13.0                   | MIT               | dev                                        |
| prettier                                    | 3.9.10                    | MIT               | dev                                        |
| tsx                                         | 4.23.15                   | MIT               | dev                                        |
| esbuild                                     | 0.28.2                    | MIT               | dev                                        |
| @types/node, @types/react, @types/react-dom | 24.19.2 / 19.3.0 / 19.3.0 | MIT               | dev                                        |

Not installed (license outside the rule, user decision pending): `@axe-core/playwright` 4.14.0 and `axe-core` are MPL-2.0.

Fonts (Phase 03): Newsreader and Geist, both SIL Open Font License 1.1 (to be confirmed when self-hosted).
