import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

import { InvestigatorTransportError, InvestigatorValidationError } from '../errors.js';
import type { InvestigatorInput } from '../types.js';
import { buildInvestigatorPrompt } from './prompt.js';

export interface InvestigatorModelResponse {
  model_id: string;
  /** Raw, untrusted model text. Only the validator may turn it into a result. */
  text: string;
}

export interface InvestigatorModelClient {
  readonly modelId: string;
  investigate(input: InvestigatorInput, signal?: AbortSignal): Promise<InvestigatorModelResponse>;
}

const THROTTLED = new Set([
  'ThrottlingException',
  'TooManyRequestsException',
  'ServiceQuotaExceededException',
]);
const SERVICE_ERRORS = new Set([
  'ModelTimeoutException',
  'ModelNotReadyException',
  'ModelErrorException',
  'ServiceUnavailableException',
  'InternalServerException',
]);
const NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
]);

function classify(error: unknown, timedOut: boolean): InvestigatorTransportError {
  const name = error instanceof Error ? error.name : '';
  if (timedOut || name === 'AbortError' || name === 'TimeoutError')
    return new InvestigatorTransportError('TIMEOUT', true);
  if (THROTTLED.has(name)) return new InvestigatorTransportError('THROTTLED', true);
  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata
    ?.httpStatusCode;
  if (SERVICE_ERRORS.has(name) || (typeof status === 'number' && status >= 500))
    return new InvestigatorTransportError('SERVICE_ERROR', true);
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && NETWORK_CODES.has(code))
    return new InvestigatorTransportError('NETWORK', true);
  return new InvestigatorTransportError('REJECTED', false);
}

/**
 * Bedrock Converse client for the Investigator. It reports transport failures
 * as typed, retriable/non-retriable errors and returns raw text; it does no
 * parsing of trust-relevant fields.
 */
export class BedrockInvestigatorClient implements InvestigatorModelClient {
  private readonly client: BedrockRuntimeClient;
  public readonly modelId: string;

  constructor(
    modelId = process.env.BEDROCK_MODEL_ID ?? 'amazon.nova-lite-v1:0',
    private readonly timeoutMs = Number(process.env.INVESTIGATOR_TIMEOUT_MS ?? 20_000),
  ) {
    this.modelId = modelId;
    // One attempt per call: bounded retry is owned by the investigation workflow.
    this.client = new BedrockRuntimeClient({ maxAttempts: 1 });
  }

  async investigate(
    input: InvestigatorInput,
    signal?: AbortSignal,
  ): Promise<InvestigatorModelResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    try {
      const prompt = buildInvestigatorPrompt(input);
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: prompt.system }],
          messages: [{ role: 'user', content: [{ text: prompt.user }] }],
          inferenceConfig: { maxTokens: 1200, temperature: 0 },
        }),
        { abortSignal: controller.signal },
      );
      const text = response.output?.message?.content?.find(
        (part) => typeof part.text === 'string',
      )?.text;
      if (!text)
        throw new InvestigatorValidationError('MALFORMED_OUTPUT', 'Model returned no text content');
      return { model_id: this.modelId, text };
    } catch (error) {
      if (error instanceof InvestigatorValidationError) throw error;
      throw classify(error, timedOut);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}
