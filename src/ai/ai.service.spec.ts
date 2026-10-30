import { ServiceUnavailableException } from '@nestjs/common';
import { EmailCategory, type Email } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiService } from './ai.service.js';
import { OllamaProvider } from './ollama.provider.js';
import { EmailService } from '../email-management/email.service.js';
import { ClassificationService } from '../filtering/classification.service.js';

describe('AiService', () => {
  const email: Email = {
    id: 'email-1',
    gmailMessageId: 'gmail-1',
    threadId: 'thread-1',
    senderEmail: 'recruiter@example.com',
    senderName: 'Recruiter',
    subject: 'Senior Engineer role',
    snippet: 'We have a role that may fit your experience.',
    body: 'Would you like to discuss the opportunity?',
    receivedAt: new Date(),
    isRead: false,
    category: EmailCategory.RECRUITER,
    categorySource: 'MANUAL',
    classificationReason: 'Manually categorized by user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let service: AiService;
  let config: { get: ReturnType<typeof vi.fn> };
  let ollama: { generate: ReturnType<typeof vi.fn> };
  let emails: { getByIdOrThrow: ReturnType<typeof vi.fn> };
  let rules: { classify: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    config = { get: vi.fn().mockReturnValue('true') };
    ollama = { generate: vi.fn() };
    emails = { getByIdOrThrow: vi.fn().mockResolvedValue(email) };
    rules = {
      classify: vi.fn().mockReturnValue({
        category: EmailCategory.RECRUITER,
        reason: 'Recruiter rule matched',
      }),
    };
    service = new AiService(
      config as never,
      ollama as unknown as OllamaProvider,
      emails as unknown as EmailService,
      rules as unknown as ClassificationService,
    );
  });

  it('validates structured AI output and preserves the manually assigned category', async () => {
    ollama.generate.mockResolvedValue(JSON.stringify({
      category: 'JOB_OPPORTUNITY',
      reason: 'The message describes an open role.',
      confidence: 0.91,
    }));

    const suggestion = await service.suggestCategory(email.id);
    expect(suggestion).toMatchObject({
      category: EmailCategory.JOB_OPPORTUNITY,
      source: 'ollama',
      currentCategory: EmailCategory.RECRUITER,
      currentCategorySource: 'MANUAL',
      fallback: false,
    });
    expect(emails.getByIdOrThrow).toHaveBeenCalledWith(email.id);
  });

  it('falls back to rule classification when Ollama fails or returns invalid data', async () => {
    ollama.generate.mockResolvedValue('{"category":"DELETE_EMAIL","reason":"do it"}');
    const suggestion = await service.suggestCategory(email.id);
    expect(suggestion).toMatchObject({ source: 'rules', fallback: true, category: 'RECRUITER' });
    expect(rules.classify).toHaveBeenCalled();

    ollama.generate.mockRejectedValue(new Error('timeout'));
    await expect(service.suggestCategory(email.id)).resolves.toMatchObject({ source: 'rules' });
  });

  it('does not invoke Ollama for classification when AI is disabled', async () => {
    config.get.mockReturnValue('false');
    await service.suggestCategory(email.id);
    expect(ollama.generate).not.toHaveBeenCalled();
    expect(rules.classify).toHaveBeenCalled();
  });

  it('requires enabled local AI for summaries and summarizes through the Ollama provider', async () => {
    config.get.mockReturnValue('false');
    await expect(service.summarizeEmail(email.id)).rejects.toThrow(ServiceUnavailableException);

    config.get.mockReturnValue('true');
    ollama.generate.mockResolvedValue('A recruiter describes a senior engineering role.');
    await expect(service.summarizeEmail(email.id)).resolves.toEqual({
      summary: 'A recruiter describes a senior engineering role.',
      source: 'ollama',
    });
    expect(ollama.generate.mock.calls.at(-1)?.[0]).toContain('untrusted_email_data');
  });
});
