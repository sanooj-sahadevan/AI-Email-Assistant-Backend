import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaGenerateResponse {
  response?: unknown;
  error?: unknown;
}

@Injectable()
export class OllamaProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(prompt: string, structured = false): Promise<string> {
    const baseUrl = this.config.getOrThrow<string>('OLLAMA_BASE_URL');
    const model = this.config.getOrThrow<string>('OLLAMA_MODEL');
    let response: Response;
    try {
      response = await fetch(new URL('/api/generate', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          ...(structured ? { format: 'json' } : {}),
          options: { temperature: 0 },
        }),
        signal: AbortSignal.timeout(
          this.config.getOrThrow<number>('OLLAMA_TIMEOUT_MS'),
        ),
      });
    } catch {
      throw new ServiceUnavailableException('The local Ollama service is unavailable or timed out.');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('The local Ollama service returned an error.');
    }

    let data: OllamaGenerateResponse;
    try {
      data = (await response.json()) as OllamaGenerateResponse;
    } catch {
      throw new ServiceUnavailableException('The local Ollama response was invalid.');
    }

    if (typeof data.response !== 'string' || !data.response.trim()) {
      throw new ServiceUnavailableException('The local Ollama response was empty.');
    }
    return data.response.trim();
  }
}
