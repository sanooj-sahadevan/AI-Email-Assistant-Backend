import { Injectable } from '@nestjs/common';
import type { ClassificationRule } from './classification-rule.interface.js';
import { DEFAULT_CLASSIFICATION_RULES } from './default-classification-rules.js';

@Injectable()
export class RuleRegistryService {
  private rules: ClassificationRule[] = [...DEFAULT_CLASSIFICATION_RULES];

  getRules(): ClassificationRule[] {
    return [...this.rules].sort((a, b) => a.priority - b.priority);
  }

  setRules(newRules: ClassificationRule[]): void {
    this.rules = [...newRules];
  }

  addRule(rule: ClassificationRule): void {
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    return this.rules.length < initialLength;
  }

  resetToDefaults(): void {
    this.rules = [...DEFAULT_CLASSIFICATION_RULES];
  }
}
