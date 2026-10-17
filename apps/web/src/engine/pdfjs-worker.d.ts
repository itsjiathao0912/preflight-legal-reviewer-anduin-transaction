// pdfjs-dist ships no type declarations for its worker module (Phase 06 D4). The `?url` form is
// covered by vite/client's `*?url` declaration.
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
