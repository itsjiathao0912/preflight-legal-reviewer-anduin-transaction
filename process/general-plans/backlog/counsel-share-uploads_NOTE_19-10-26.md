---
name: note:counsel-share-uploads
description: "Accepted gap: uploads and assembled packages cannot be shared with counsel"
date: 19-10-26
---

# Counsel share link - uploads not shareable (accepted gap)

Share is enabled only for bundled demo packages and samples (`docRefOf` in `apps/web/src/features/open-document/demo-refs.ts`); anything else shows "Sharing works for demo packages only." Counsel's browser re-opens the same bundled files, so documents are never stored on the server.

To lift: counsel would need the document bytes (upload storage or analyst-side relay), which changes the "documents never stored" rule. Needs its own SPEC.
