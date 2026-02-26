import { Transaction } from '@solana/web3.js';

export interface PolicyConfig {
  spendingLimits: {
    perTransaction: number;  // in SOL
    perHour: number;
    perDay: number;
  };
  timeLocks?: {
    highValueDelay?: number;  // seconds
  };
  allowedProtocols?: string[];  // Program IDs
  allowedTokens?: string[];     // Mint addresses
  circuitBreakers?: {
    maxDrawdown?: number;       // 0.2 = 20%
    unusualPattern?: boolean;
  };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class PolicyEngine {
  private config: PolicyConfig;
  private hourlySpent: number = 0;
  private dailySpent: number = 0;
  private lastReset: number = Date.now();

  constructor(config: PolicyConfig) {
    this.config = config;
  }

  validate(transaction: Transaction, estimatedValue: number = 0): ValidationResult {
    // Check spending limits
    if (estimatedValue > this.config.spendingLimits.perTransaction) {
      return {
        valid: false,
        reason: `Transaction value ${estimatedValue} SOL exceeds limit ${this.config.spendingLimits.perTransaction} SOL`
      };
    }

    // Reset counters if needed
    const now = Date.now();
    if (now - this.lastReset > 86400000) { // 24 hours
      this.dailySpent = 0;
      this.hourlySpent = 0;
      this.lastReset = now;
    } else if (now - this.lastReset > 3600000) { // 1 hour
      this.hourlySpent = 0;
    }

    // Check hourly limit
    if (this.hourlySpent + estimatedValue > this.config.spendingLimits.perHour) {
      return {
        valid: false,
        reason: `Hourly limit ${this.config.spendingLimits.perHour} SOL exceeded`
      };
    }

    // Check daily limit
    if (this.dailySpent + estimatedValue > this.config.spendingLimits.perDay) {
      return {
        valid: false,
        reason: `Daily limit ${this.config.spendingLimits.perDay} SOL exceeded`
      };
    }

    return { valid: true };
  }

  recordSpend(amount: number) {
    this.hourlySpent += amount;
    this.dailySpent += amount;
  }

  freeze() {
    // Emergency stop
    this.config.spendingLimits.perTransaction = 0;
    this.config.spendingLimits.perHour = 0;
    this.config.spendingLimits.perDay = 0;
  }

  getConfig(): PolicyConfig {
    return this.config;
  }
}