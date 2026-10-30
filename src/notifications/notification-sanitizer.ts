import { EmailCategory } from '@prisma/client';

export function sanitizeSnippet(
  rawSnippet: string | null | undefined,
  maxLength = 150,
): string {
  if (!rawSnippet) return '(No preview available)';

  // Remove HTML tags
  let cleaned = rawSnippet.replace(/<[^>]*>/g, ' ');

  // Collapse multiple whitespaces and newlines
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Strip potential sensitive patterns (passwords, tokens, OTP codes, credit cards)
  cleaned = cleaned.replace(/\b(password|passwd|pwd|secret|api[_-]?key|token|auth)\s*[:=]\s*\S+/gi, '[REDACTED]');
  cleaned = cleaned.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED_CARD]');
  cleaned = cleaned.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength).trim()}…`;
}

export function sanitizeErrorDetails(error: unknown): string {
  if (!error) return 'Unknown error';

  let rawMessage: string;
  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'string') {
    rawMessage = error;
  } else {
    try {
      rawMessage = JSON.stringify(error) ?? 'Unknown error';
    } catch {
      rawMessage = 'Error occurred during notification delivery';
    }
  }

  // Sanitize any Bearer tokens, Authorization headers, or secret hex strings
  let sanitized = rawMessage.replace(/Bearer\s+[\w.-]+/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/([?&](?:access_token|secret|key)=)[\w.-]+/gi, '$1[REDACTED]');
  sanitized = sanitized.replace(/[\da-f]{32,64}/gi, (match) => {
    // Redact long hex tokens that look like crypto keys or session hashes
    if (match.length >= 32) return `${match.slice(0, 4)}...[REDACTED]`;
    return match;
  });

  return sanitized.slice(0, 500);
}

const CATEGORY_NAMES: Record<EmailCategory, string> = {
  LINKEDIN_NOTIFICATION: 'LinkedIn',
  JOB_OPPORTUNITY: 'Job Opportunities',
  RECRUITER: 'Recruiters',
  COMPANY: 'Company',
  PERSONAL: 'Personal',
  OTHER: 'Other',
};

export function formatWhatsAppAlertMessage(params: {
  category?: EmailCategory | null;
  senderName?: string | null;
  senderEmail?: string | null;
  subject: string;
  snippet?: string | null;
  maxSnippetLength?: number;
}): string {
  const categoryLabel = params.category
    ? (CATEGORY_NAMES[params.category] ?? params.category)
    : 'General';

  const sender = params.senderName
    ? `${params.senderName}${params.senderEmail ? ` (${params.senderEmail})` : ''}`
    : (params.senderEmail ?? 'Unknown sender');

  const snippet = sanitizeSnippet(
    params.snippet,
    params.maxSnippetLength ?? 150,
  );

  return [
    '🔔 *Important Email Alert*',
    `*Category:* ${categoryLabel}`,
    `*From:* ${sender}`,
    `*Subject:* ${params.subject.trim() || '(No subject)'}`,
    `*Preview:* ${snippet}`,
  ].join('\n');
}
