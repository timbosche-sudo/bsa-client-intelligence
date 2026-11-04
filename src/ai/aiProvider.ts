/**
 * AI integration boundary (Part 14). The application is fully functional without AI.
 *
 * Rules enforced by this interface:
 *  - Output is always an AiSuggestion (status "suggested") that a person must review before saving.
 *  - Providers never create approved decisions or records directly.
 *  - No API keys in the browser. A production provider calls a BSA-approved server endpoint
 *    (e.g. Azure OpenAI behind Entra ID) that applies confidentiality filtering and logs usage.
 *  - Confidential data is never sent unless an approved configuration is active.
 */
import { environment } from '@/config/environment';

export interface AiSuggestion {
  status: 'suggested';
  text: string;
  /** e.g. "azure-openai:gpt-…" — recorded so AI-assisted content is traceable. */
  source: string;
  generatedAt: string;
  /** Human-readable note of which records were sent. */
  inputsSummary: string;
}

export interface AiCapabilities {
  meetingSummary: boolean;
  actionExtraction: boolean;
  reportDrafting: boolean;
}

export interface AiProvider {
  readonly id: string;
  readonly enabled: boolean;
  /** Why the provider is unavailable, for display. */
  readonly unavailableReason: string | null;
  readonly capabilities: AiCapabilities;
  draftExecutiveSummary(input: { clientName: string; facts: string }): Promise<AiSuggestion>;
  summarizeMeeting(input: { title: string; notes: string }): Promise<AiSuggestion>;
  extractActions(input: { notes: string }): Promise<AiSuggestion>;
}

export class AiUnavailableError extends Error {}

const DISABLED_REASON = 'AI is disabled. It requires a BSA-approved, server-side integration; no data leaves this browser.';

/** Default provider: every capability is unavailable and nothing is sent anywhere. */
export const disabledAiProvider: AiProvider = {
  id: 'disabled',
  enabled: false,
  unavailableReason: DISABLED_REASON,
  capabilities: { meetingSummary: false, actionExtraction: false, reportDrafting: false },
  draftExecutiveSummary: () => Promise.reject(new AiUnavailableError(DISABLED_REASON)),
  summarizeMeeting: () => Promise.reject(new AiUnavailableError(DISABLED_REASON)),
  extractActions: () => Promise.reject(new AiUnavailableError(DISABLED_REASON)),
};

/**
 * Returns the active provider. Only the disabled provider exists in Prototype Mode; a future
 * `ServerAiProvider` would be returned when `environment.aiEnabled` and an approved endpoint are configured.
 */
export function getAiProvider(): AiProvider {
  return environment.aiEnabled ? disabledAiProvider : disabledAiProvider;
}
