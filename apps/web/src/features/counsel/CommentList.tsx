import { COUNSEL_COMMENT_MAX, type CounselComment } from '@aduin/core';
import { useState, type FormEvent } from 'react';
import { postComment } from '../../api/counselShareApi';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { commentsFor, useShare } from './counsel-share';

function when(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Per-question comments (counsel share link): the thread from the last sheet read, oldest first,
 * plus a post box. Both roles post; the Worker masks the body and takes the author from the cookie.
 */
export function CommentList({ questionId }: { questionId: string }) {
  const sheet = useShare((s) => s.sheet);
  const addComment = useShare((s) => s.addComment);
  const showToast = useReview((s) => s.showToast);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const list: CounselComment[] = commentsFor(sheet, questionId);
  const id = `cm-${questionId}`;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const b = body.trim();
    if (!b || busy) return;
    setBusy(true);
    try {
      addComment(await postComment(questionId, b));
      setBody('');
    } catch {
      showToast('The comment could not be posted. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="cmts" aria-label="Comments" data-testid="counsel-comments">
      {list.length ? (
        <ul>
          {list.map((c) => (
            <li key={c.id} data-testid="counsel-comment" data-role={c.author_role}>
              <div className="h">
                <b>{c.author_name}</b>
                <span className="tag t-st">
                  {c.author_role === 'counsel' ? 'Counsel' : 'Analyst'}
                </span>
                <span className="dim">{when(c.created_at)}</span>
              </div>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim" data-testid="counsel-comments-none">
          No comments yet.
        </p>
      )}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label className="sr" htmlFor={id}>
          Add a comment
        </label>
        <textarea
          id={id}
          rows={2}
          maxLength={COUNSEL_COMMENT_MAX}
          placeholder="Add a comment"
          data-testid="counsel-comment-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
          }}
        />
        <button
          type="submit"
          className="btn sm"
          data-testid="counsel-comment-post"
          disabled={busy || !body.trim()}
        >
          <Icon name="check" />
          {busy ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </section>
  );
}
