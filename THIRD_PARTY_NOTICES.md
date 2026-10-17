# Third-Party Notices

Direct dependencies of this workspace and their licenses (checked against the npm registry on 2026-10-17).
Project rule: only MIT / BSD / Apache-2.0 / ISC code (fonts: OFL). Keep upstream notices when copying code.

| Package                                         | Version                   | License           | Used in                                    |
| ----------------------------------------------- | ------------------------- | ----------------- | ------------------------------------------ |
| react, react-dom                                | 19.3.1                    | MIT               | @aduin/web                                 |
| @radix-ui/react-slot                            | 1.5.0                     | MIT               | @aduin/web                                 |
| @radix-ui/react-dialog, @radix-ui/react-popover | 1.3.1 / 1.3.1             | MIT               | @aduin/web                                 |
| @fontsource/geist (Geist font files)            | 5.3.0                     | OFL-1.1           | @aduin/web (self-hosted font)              |
| @fontsource/newsreader (Newsreader font files)  | 5.3.0                     | OFL-1.1           | @aduin/web (self-hosted font)              |
| @tanstack/react-table                           | 9.3.1                     | MIT               | @aduin/web                                 |
| zustand                                         | 5.0.15                    | MIT               | @aduin/web                                 |
| dexie                                           | 4.4.6                     | Apache-2.0        | @aduin/web                                 |
| comlink                                         | 4.4.2                     | Apache-2.0        | @aduin/web                                 |
| docx                                            | 9.11.0                    | MIT               | @aduin/web, @aduin/scripts (dev, fixtures) |
| pdfjs-dist                                      | 6.4.299                   | Apache-2.0        | @aduin/web, @aduin/scripts (dev)           |
| htmlparser2                                     | 12.0.0                    | MIT               | @aduin/core, @aduin/scripts                |
| unpdf                                           | 1.9.0                     | MIT               | @aduin/core                                |
| mammoth                                         | 1.13.0                    | BSD-2-Clause      | @aduin/core, @aduin/web (dev)              |
| jpeg-js                                         | 0.4.4                     | BSD-3-Clause      | @aduin/scripts (dev, scan-set downscale)   |
| diff (jsdiff)                                   | 9.0.0                     | BSD-3-Clause      | @aduin/core                                |
| zod                                             | 4.6.7                     | MIT               | @aduin/core, @aduin/worker, @aduin/scripts |
| @noble/hashes                                   | 2.4.0                     | MIT               | @aduin/core, @aduin/worker, @aduin/scripts |
| vite                                            | 8.3.4                     | MIT               | dev                                        |
| @vitejs/plugin-react                            | 6.1.2                     | MIT               | dev                                        |
| tailwindcss, @tailwindcss/vite                  | 4.3.3                     | MIT               | dev                                        |
| vitest                                          | 4.1.12                    | MIT               | dev                                        |
| fast-check                                      | 4.10.2                    | MIT               | dev                                        |
| @cloudflare/vitest-plugin                       | 1.4.4                     | MIT               | dev                                        |
| @cloudflare/workers-types                       | 5.20261016.1              | MIT OR Apache-2.0 | dev                                        |
| wrangler                                        | 4.151.1                   | MIT OR Apache-2.0 | dev                                        |
| @playwright/test                                | 1.64.1                    | Apache-2.0        | dev                                        |
| @axe-core/playwright (bundles axe-core)         | 4.14.0                    | MPL-2.0           | dev only, @aduin/web a11y tests (D-8)      |
| fake-indexeddb                                  | 6.2.5                     | Apache-2.0        | dev (@aduin/web Vitest)                    |
| jsdom                                           | 30.1.3                    | MIT               | dev                                        |
| typescript                                      | 6.0.3                     | Apache-2.0        | dev                                        |
| typescript-eslint                               | 8.71.2                    | MIT               | dev                                        |
| eslint, @eslint/js                              | 10.13.0 / 10.0.1          | MIT               | dev                                        |
| globals                                         | 17.13.0                   | MIT               | dev                                        |
| prettier                                        | 3.9.10                    | MIT               | dev                                        |
| tsx                                             | 4.23.15                   | MIT               | dev (@aduin/scripts, @aduin/web)           |
| esbuild                                         | 0.28.2                    | MIT               | dev                                        |
| @types/node, @types/react, @types/react-dom     | 24.19.2 / 19.3.0 / 19.3.0 | MIT               | dev                                        |

Ideas ported without copying code (own implementation and tests): defined-term extraction patterns from `defined-terms-checker` (MIT), Phase 01 `packages/core/src/structure/defined-terms.ts`. Phase 01 added no new dependencies; `htmlparser2`, `zod`, `@noble/hashes` and `fast-check` were already pinned in Phase 00.

Phase 03: `@axe-core/playwright` 4.14.0 and `axe-core` (MPL-2.0) installed as dev-only test dependencies after user decision D-8 (see the exception below). Fonts Newsreader and Geist confirmed SIL OFL 1.1 and self-hosted.

MPL-2.0 exception (D-8, user-decided): axe-core via @axe-core/playwright is a dev-only test dependency of
@aduin/web; it is never bundled or shipped. Geist and Newsreader are licensed under the SIL Open Font License 1.1
and are self-hosted from @fontsource (upstream notices kept in the font packages).

## Phase 06 parsing stack: transitive license notes (checked with `pnpm licenses list`, 2026-10-17)

- mammoth 1.13.0 (BSD-2-Clause) pulls: `argparse` 1.0.10 (**MIT** per `pnpm licenses list`; some
  registry mirrors label the 1.x line Python-2.0, which is also permissive, so either way it is
  allowed), `jszip` 3.10.2 (dual `MIT OR GPL-3.0-or-later`; used under **MIT**), `pako` 1.0.11
  (`MIT AND Zlib`), `lop` 0.4.2, `option` 0.2.4, `dingbat-to-unicode` 1.0.2 (BSD-2-Clause),
  `underscore` 1.13.8, `xmlbuilder` 10.1.1, `@xmldom/xmldom` 0.8.15, `base64-js` 1.5.1 (MIT),
  `sprintf-js` 1.0.3 (BSD-3-Clause).
- unpdf 1.9.0 (MIT) bundles pdf.js (Apache-2.0); pdfjs-dist 6.4.299 (Apache-2.0) ships its own
  NOTICE/LICENSE in the package, which the web bundle carries through the emitted pdf.js chunks.
- jpeg-js 0.4.4 (BSD-3-Clause) is a dev-only dependency of `@aduin/scripts`; it never ships in the
  web or Worker bundle (it only downscales the bundled sample #9 page images at sample-copy time).

## Phase 10 license election and transitive additions (final deploy, 2026-10-17)

Transitive packages that need a stated election or a non-MIT/BSD/Apache/ISC license. All are
permissive and none are copied into this repository; they arrive through `pnpm install`.

| Package                                       | Version                       | License as published    | Election / note                                                                             | Pulled in by             |
| --------------------------------------------- | ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| sax                                           | 1.6.1                         | BlueOak-1.0.0           | Permissive, OSI-approved. Used as published; the BlueOak license text ships in the package. | mammoth (via xmlbuilder) |
| pako                                          | 1.0.11                        | MIT AND Zlib            | Both licenses are permissive; both notices stay in the package.                             | jszip (via mammoth)      |
| jszip                                         | 3.10.2                        | MIT OR GPL-3.0-or-later | **Elected: MIT.** The GPL option is not used.                                               | mammoth                  |
| lie, immediate, setimmediate, readable-stream | 3.3.0 / 3.0.6 / 1.0.5 / 2.3.8 | MIT                     | Transitive of jszip; no election needed.                                                    | jszip                    |

Elections follow the project rule (MIT / BSD / Apache-2.0 / ISC / BlueOak, fonts OFL). The one
exception that is not in that list is the dev-only MPL-2.0 `axe-core` (decision D-8, above); it is
never bundled or shipped. Run `pnpm licenses list` for the full resolved tree.
