import { Injectable } from '@nestjs/common';
import type {
  ClassificationResult,
  ClassificationRule,
  EmailClassificationInput,
} from './classification-rule.interface.js';
import { RuleRegistryService } from './rule-registry.service.js';

@Injectable()
export class ClassificationService {
  constructor(private readonly ruleRegistry: RuleRegistryService) {}

  classify(email: EmailClassificationInput): ClassificationResult {
    const senderEmail = (email.senderEmail ?? '').toLowerCase().trim();
    const senderDomain = this.extractDomain(senderEmail);
    const subject = (email.subject ?? '').toLowerCase();
    const snippet = (email.snippet ?? '').toLowerCase();
    const body = (email.body ?? '').toLowerCase();
    const content = `${snippet} ${body}`.trim();

    const rules = this.ruleRegistry.getRules();

    for (const rule of rules) {
      if (this.matchesRule(rule, senderEmail, senderDomain, subject, content)) {
        return {
          category: rule.category,
          reason: rule.reason,
          matchedRuleId: rule.id,
        };
      }
    }

    return {
      category: 'OTHER',
      reason: 'Default classification (no specific rule matched)',
    };
  }

  classifyMany(emails: EmailClassificationInput[]): ClassificationResult[] {
    return emails.map((email) => this.classify(email));
  }

  private extractDomain(emailAddress: string): string | null {
    if (!emailAddress) return null;
    const atIndex = emailAddress.lastIndexOf('@');
    if (atIndex < 0 || atIndex === emailAddress.length - 1) return null;
    return emailAddress.slice(atIndex + 1).toLowerCase();
  }

  private matchesRule(
    rule: ClassificationRule,
    senderEmail: string,
    senderDomain: string | null,
    subject: string,
    content: string,
  ): boolean {
    const { condition } = rule;

    // Check sender address
    if (condition.senderAddresses && senderEmail) {
      const match = condition.senderAddresses.some((addr) =>
        senderEmail === addr.toLowerCase() || senderEmail.includes(addr.toLowerCase()),
      );
      if (match) return true;
    }

    // Check sender domain
    if (condition.senderDomains && senderDomain) {
      const match = condition.senderDomains.some((domain) => {
        const d = domain.toLowerCase();
        return senderDomain === d || senderDomain.endsWith(`.${d}`);
      });
      if (match) return true;
    }

    // Check subject keywords
    if (condition.subjectKeywords && subject) {
      const match = condition.subjectKeywords.some((keyword) =>
        subject.includes(keyword.toLowerCase()),
      );
      if (match) return true;
    }

    // Check snippet / content keywords
    if (condition.snippetKeywords && content) {
      const match = condition.snippetKeywords.some((keyword) =>
        content.includes(keyword.toLowerCase()),
      );
      if (match) return true;
    }

    return false;
  }
}
