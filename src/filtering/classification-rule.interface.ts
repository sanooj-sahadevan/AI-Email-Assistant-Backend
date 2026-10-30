import type { EmailCategory } from '@prisma/client';

export interface ClassificationRuleCondition {
  senderAddresses?: string[];
  senderDomains?: string[];
  subjectKeywords?: string[];
  snippetKeywords?: string[];
}

export interface ClassificationRule {
  id: string;
  name: string;
  category: EmailCategory;
  priority: number;
  condition: ClassificationRuleCondition;
  reason: string;
}

export interface EmailClassificationInput {
  senderEmail?: string | null;
  senderName?: string | null;
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
}

export interface ClassificationResult {
  category: EmailCategory;
  reason: string;
  matchedRuleId?: string;
}
