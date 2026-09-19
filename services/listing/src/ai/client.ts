import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

import { buildListingGuardPrompt } from './prompt.js';
import type { ListingInput } from '../types.js';

export interface ListingGuardModelClient {
  analyze(input: ListingInput, signal?: AbortSignal): Promise<unknown>;
}

export class BedrockListingGuardClient implements ListingGuardModelClient {
  private readonly client: BedrockRuntimeClient;
  public readonly modelId: string;
  constructor(
    modelId = process.env.BEDROCK_MODEL_ID ?? 'amazon.nova-lite-v1:0',
    private readonly timeoutMs = Number(process.env.BEDROCK_TIMEOUT_MS ?? 8000),
  ) {
    this.modelId = modelId;
    this.client = new BedrockRuntimeClient({});
  }

  async analyze(input: ListingInput, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    try {
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          messages: [{ role: 'user', content: [{ text: buildListingGuardPrompt(input) }] }],
          inferenceConfig: { maxTokens: 800, temperature: 0 },
        }),
        { abortSignal: controller.signal },
      );
      const text = response.output?.message?.content?.find(
        (part) => typeof part.text === 'string',
      )?.text;
      if (!text) throw new Error('Bedrock returned no text content');
      const cleaned = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      return JSON.parse(cleaned);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}

export function modelId(client: BedrockListingGuardClient): string {
  return client.modelId;
}
