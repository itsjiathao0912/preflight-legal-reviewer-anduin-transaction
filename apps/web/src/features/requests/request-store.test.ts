import { beforeEach, describe, expect, it } from 'vitest';
import { clean, useRequests } from './request-store';
import { roundOf } from './request-model';

describe('request rounds', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useRequests.setState({ docKey: null, meta: {} });
    useRequests.getState().load('r1');
  });

  it('counts rounds, sends again only after new questions, and counts asks', () => {
    const s = useRequests.getState;
    s().markSent('counsel', 2, ['a', 'b'], 1000);
    expect(s().meta.counsel).toMatchObject({ round: 1, sentAt: 1000, sentCount: 2 });
    s().markSent('counsel', 2, ['a', 'b'], 2000);
    expect(s().meta.counsel?.round).toBe(1);
    s().addExtra('counsel', { where: 'Section 12', quote: '', question: 'Both (a) and (b)?' });
    s().markSent('counsel', 2, ['a'], 3000);
    expect(s().meta.counsel).toMatchObject({ round: 2, sentAt: 3000, sentCount: 3 });
    expect(s().meta.counsel?.asked).toEqual({ a: 2, b: 1 });
    const id = s().meta.counsel!.extra![0]!.id;
    s().removeExtra('counsel', id);
    expect(s().meta.counsel?.extra).toEqual([]);
  });

  it('cleans stored data and reads old data as round 1', () => {
    const m = clean({
      gp: {
        sentAt: 5,
        round: 500,
        asked: { k: 2, bad: -1 },
        extra: [{ id: 'x', question: 'Q?' }, 7],
      },
      counsel: { sentAt: 5 },
    });
    expect(m.gp?.round).toBeUndefined();
    expect(m.gp?.asked).toEqual({ k: 2 });
    expect(m.gp?.extra).toEqual([{ id: 'x', where: '', quote: '', question: 'Q?', at: 0 }]);
    expect(roundOf(m.counsel)).toBe(1);
  });
});
