/**
 * Phase 07A (task P7A-AI-01) Bedrock Converse client for
 * `amazon.nova-lite-v1:0`. Receives image BYTES already read from the
 * private S3 object by the caller (`services/image`) — never a presigned
 * URL, never persisted anywhere.
 */
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

import { buildImageAnalysisPrompt } from './prompt.js';
import type { ImageAnalysisPromptContext } from './prompt.js';

export interface ImageAnalysisModelClient {
  analyze(
    context: ImageAnalysisPromptContext,
    imageBytes: Uint8Array,
    imageFormat: 'jpeg' | 'png',
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export class BedrockImageAnalysisClient implements ImageAnalysisModelClient {
  private readonly client: BedrockRuntimeClient;
  public readonly modelId: string;
  constructor(
    modelId = process.env.BEDROCK_MODEL_ID ?? 'amazon.nova-lite-v1:0',
    private readonly timeoutMs = Number(process.env.IMAGE_ANALYSIS_TIMEOUT_MS ?? 15000),
  ) {
    this.modelId = modelId;
    this.client = new BedrockRuntimeClient({});
  }

  async analyze(
    context: ImageAnalysisPromptContext,
    imageBytes: Uint8Array,
    imageFormat: 'jpeg' | 'png',
    signal?: AbortSignal,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    try {
      const response = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          messages: [
            {
              role: 'user',
              content: [
                { text: buildImageAnalysisPrompt(context) },
                { image: { format: imageFormat, source: { bytes: imageBytes } } },
              ],
            },
          ],
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
      try {
        return JSON.parse(cleaned);
      } catch {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start)
          throw new SyntaxError('Bedrock response did not contain a JSON object');
        return JSON.parse(cleaned.slice(start, end + 1));
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}

export function imageAnalysisModelId(client: BedrockImageAnalysisClient): string {
  return client.modelId;
}
