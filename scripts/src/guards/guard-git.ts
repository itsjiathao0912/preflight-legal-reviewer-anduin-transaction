// Documentation helper (plan C5). `git push` is a HARD STOP in this project: no push without
// the user's explicit OK, and nothing in this repo automates a push. This file intentionally
// exports no push helper.
export const GIT_PUSH_POLICY = 'git push requires explicit user approval; never automated' as const;
