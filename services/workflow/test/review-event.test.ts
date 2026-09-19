import type { ReturnCase } from '@returnshield/data';
import { describe, expect, it } from 'vitest';

import storiesFile from '../../../contracts/seeds/stories.json';
import { awaitsExplanation, buildReviewEvent } from '../src/review-event.js';

function caseFor(id: 'clean' | 'review' | 'high'): ReturnCase {
  const story = storiesFile.stories.find((item) => item.story_id === id);
  if (!story) throw new Error(`Missing story ${id}`);
  const value = structuredClone(story.expected_case) as unknown as ReturnCase;
  return {
    ...value,
    revision: 1,
    explanation_status: id === 'clean' ? 'NOT_REQUESTED' : 'PENDING',
    explanation: null,
    timeline: value.timeline.filter((entry) => entry.type !== 'EXPLANATION_AVAILABLE'),
  };
}

describe('review event', () => {
  it.each(['review', 'high'] as const)('builds a stable contract-valid event for %s', (id) => {
    const value = caseFor(id);
    const first = buildReviewEvent(value);
    const second = buildReviewEvent(structuredClone(value));

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      event_type: 'RETURN_NEEDS_REVIEW',
      event_id: `CASE-${id}-RETURN_NEEDS_REVIEW`,
      case_id: `CASE-${id}`,
      risk_score: id === 'review' ? 45 : 100,
      priority: id === 'review' ? 'NORMAL' : 'HIGH',
      occurred_at: value.created_at,
    });
    expect(awaitsExplanation(value)).toBe(true);
  });

  it('does not emit for an auto-approved case or a completed explanation', () => {
    expect(buildReviewEvent(caseFor('clean'))).toBeUndefined();
    expect(awaitsExplanation({ ...caseFor('high'), explanation_status: 'AVAILABLE' })).toBe(false);
  });
});
