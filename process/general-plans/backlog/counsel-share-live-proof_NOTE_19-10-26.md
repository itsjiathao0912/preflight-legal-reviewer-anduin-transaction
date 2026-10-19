---
name: note:counsel-share-live-proof
description: "Residual: counsel share link has no live or two-browser proof (no e2e by user choice)"
date: 19-10-26
---

# Counsel share link - live / two-browser proof (residual)

Known gap from `process/general-plans/active/counsel-share-link_19-10-26/`. The user dropped e2e on 19-10-26, so the two-browser flow (analyst shares a demo package, counsel joins in another browser, same finding ids, answers and comments visible within ~20 s, Mark ready) is proven only by unit tests of each part.

To close: a stack-memory spec (wrangler dev + local D1, second context with its own IP) or a manual two-browser run on workers.dev after the schema 7 roll-forward deploy. Also covers: token theft within 7 days (no revoke, accepted).
