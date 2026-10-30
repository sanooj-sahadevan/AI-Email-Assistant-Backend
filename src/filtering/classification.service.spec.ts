import { describe, it, expect, beforeEach } from 'vitest';
import { ClassificationService } from './classification.service.js';
import { RuleRegistryService } from './rule-registry.service.js';

describe('ClassificationService', () => {
  let ruleRegistry: RuleRegistryService;
  let service: ClassificationService;

  beforeEach(() => {
    ruleRegistry = new RuleRegistryService();
    service = new ClassificationService(ruleRegistry);
  });

  describe('default rule classifications', () => {
    it('classifies LinkedIn emails by sender domain', () => {
      const result = service.classify({
        senderEmail: 'invitations@linkedin.com',
        subject: 'You have a new message',
        snippet: 'Click to view',
      });
      expect(result.category).toBe('LINKEDIN_NOTIFICATION');
      expect(result.reason).toContain('LinkedIn');
    });

    it('classifies LinkedIn emails by subject keyword even from generic sender', () => {
      const result = service.classify({
        senderEmail: 'updates@notification-hub.com',
        subject: 'Ada, you have an invitation to connect on LinkedIn',
        snippet: 'Connect with people you know',
      });
      expect(result.category).toBe('LINKEDIN_NOTIFICATION');
    });

    it('classifies Recruiter outreach by domain', () => {
      const result = service.classify({
        senderEmail: 'sarah.j@roberthalf.com',
        subject: 'Quick chat regarding potential roles',
        snippet: 'I came across your profile and thought of this opportunity',
      });
      expect(result.category).toBe('RECRUITER');
      expect(result.reason).toContain('recruiter');
    });

    it('classifies Recruiter outreach by snippet keywords', () => {
      const result = service.classify({
        senderEmail: 'alex@consultancy.org',
        subject: 'Exciting career discussion',
        snippet: 'I am an executive recruiter at TechTalent and wanted to reach out regarding your background.',
      });
      expect(result.category).toBe('RECRUITER');
    });

    it('classifies Job Opportunities from ATS domains like greenhouse.io', () => {
      const result = service.classify({
        senderEmail: 'no-reply@greenhouse.io',
        subject: 'Thank you for applying to Stripe',
        snippet: 'We have received your application for Senior Software Engineer.',
      });
      expect(result.category).toBe('JOB_OPPORTUNITY');
      expect(result.reason).toContain('applicant tracking system');
    });

    it('classifies Job Opportunities by interview subject keywords', () => {
      const result = service.classify({
        senderEmail: 'talent@startup.ai',
        subject: 'Technical Interview Invitation: Software Engineer',
        snippet: 'Please select a slot for your 45-minute coding interview.',
      });
      expect(result.category).toBe('JOB_OPPORTUNITY');
    });

    it('classifies Company emails by workspace tool domain and subject', () => {
      const result = service.classify({
        senderEmail: 'notifications@github.com',
        subject: '[GitHub] Security alert: Dependabot flagged a vulnerability',
        snippet: 'Review the pull request to update dependencies.',
      });
      expect(result.category).toBe('COMPANY');
    });

    it('classifies Company invoices and billing updates', () => {
      const result = service.classify({
        senderEmail: 'billing@aws.amazon.com',
        subject: 'Your Monthly Invoice for October',
        snippet: 'Your invoice is ready for download.',
      });
      expect(result.category).toBe('COMPANY');
    });

    it('classifies Personal emails from personal webmail domains with friendly subjects', () => {
      const result = service.classify({
        senderEmail: 'grandma@gmail.com',
        subject: 'Catching up this weekend',
        snippet: 'Hope you are doing well, let me know if you can make it to dinner!',
      });
      expect(result.category).toBe('PERSONAL');
      expect(result.reason).toContain('personal');
    });

    it('falls back to OTHER category when no rules match', () => {
      const result = service.classify({
        senderEmail: 'newsletter@randomblog.xyz',
        subject: 'Top 10 gadgets of the month',
        snippet: 'Check out these cool tech accessories on sale now.',
      });
      expect(result.category).toBe('OTHER');
      expect(result.reason).toContain('Default classification');
    });
  });

  describe('configurable rules', () => {
    it('supports custom rules with higher priority that override default behavior', () => {
      ruleRegistry.addRule({
        id: 'rule-vip-personal',
        name: 'VIP Client',
        category: 'PERSONAL',
        priority: 1, // Higher priority than LinkedIn or Job
        condition: {
          senderAddresses: ['ceo@linkedin.com'],
        },
        reason: 'Direct VIP correspondence',
      });

      const result = service.classify({
        senderEmail: 'ceo@linkedin.com',
        subject: 'Hello friend',
        snippet: 'Let us grab lunch',
      });

      expect(result.category).toBe('PERSONAL');
      expect(result.reason).toBe('Direct VIP correspondence');
      expect(result.matchedRuleId).toBe('rule-vip-personal');
    });

    it('supports removing rules', () => {
      const removed = ruleRegistry.removeRule('rule-linkedin');
      expect(removed).toBe(true);

      const result = service.classify({
        senderEmail: 'notifications-noreply@linkedin.com',
        subject: 'Update',
        snippet: 'Notification',
      });
      expect(result.category).not.toBe('LINKEDIN_NOTIFICATION');
    });

    it('supports resetting to default rules', () => {
      ruleRegistry.setRules([]);
      expect(ruleRegistry.getRules()).toHaveLength(0);

      ruleRegistry.resetToDefaults();
      expect(ruleRegistry.getRules().length).toBeGreaterThan(0);
    });
  });
});
