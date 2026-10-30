import type { EmailCategory } from '@prisma/client';

export type RuleAction = 'NOTIFY' | 'IGNORE';

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: {
    categories?: EmailCategory[];
    senderAddresses?: string[];
    senderDomains?: string[];
    keywords?: string[];
  };
  action: RuleAction;
  customRecipient?: string;
}

export interface NotificationConfigData {
  enabledCategories: EmailCategory[];
  rules: NotificationRule[];
  recipientPhone: string;
  maxSnippetLength: number;
  initialSyncCutoffHours: number;
  deliveryProvider?: string;
}

export const DEFAULT_NOTIFICATION_RULES: NotificationRule[] = [
  {
    id: 'rule-job-interviews',
    name: 'Urgent Job Interviews & Offers',
    enabled: true,
    priority: 10,
    match: {
      categories: ['JOB_OPPORTUNITY'],
      keywords: ['interview invitation', 'offer letter', 'next steps', 'phone screen'],
    },
    action: 'NOTIFY',
  },
  {
    id: 'rule-recruiter-outreach',
    name: 'Direct Recruiter Inquiries',
    enabled: true,
    priority: 20,
    match: {
      categories: ['RECRUITER'],
    },
    action: 'NOTIFY',
  },
  {
    id: 'rule-ignore-newsletters',
    name: 'Ignore Uncategorized Bulk Content',
    enabled: true,
    priority: 90,
    match: {
      categories: ['OTHER'],
    },
    action: 'IGNORE',
  },
];

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfigData = {
  enabledCategories: ['LINKEDIN_NOTIFICATION'],
  rules: DEFAULT_NOTIFICATION_RULES,
  recipientPhone: '+917994811405',
  maxSnippetLength: 150,
  initialSyncCutoffHours: 24,
};
