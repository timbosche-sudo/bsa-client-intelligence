import { describe, expect, it } from 'vitest';
import { AiUnavailableError, getAiProvider } from './aiProvider';

describe('AI provider (Prototype Mode)', () => {
  it('is disabled and never produces content', async () => {
    const ai = getAiProvider();
    expect(ai.enabled).toBe(false);
    expect(ai.unavailableReason).toMatch(/server-side/);
    await expect(ai.draftExecutiveSummary({ clientName: 'x', facts: 'y' })).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(ai.extractActions({ notes: 'n' })).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
