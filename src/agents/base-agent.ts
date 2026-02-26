import { NexusWallet } from '../core/wallet';
import { AuditLogger } from '../core/audit';

export interface AgentConfig {
  name: string;
  strategy: string;
  checkInterval?: number;  // milliseconds
  autoStart?: boolean;
}

export abstract class BaseAgent {
  id: string;
  name: string;
  wallet: NexusWallet;
  config: AgentConfig;
  audit: AuditLogger;
  running: boolean = false;
  lastCheck: number = 0;

  constructor(wallet: NexusWallet, config: AgentConfig) {
    this.id = wallet.agentId;
    this.name = config.name;
    this.wallet = wallet;
    this.config = config;
    this.audit = new AuditLogger(wallet.id, this.id);
  }

  abstract evaluate(): Promise<any>;
  abstract execute(opportunity: any): Promise<void>;

  async start() {
    this.running = true;
    await this.audit.log('AGENT_STARTED', { config: this.config });
    console.log(`🤖 Agent ${this.name} started`);

    while (this.running) {
      try {
        this.lastCheck = Date.now();
        const opportunity = await this.evaluate();
        
        if (opportunity) {
          await this.execute(opportunity);
        }
      } catch (error) {
        console.error(`Agent ${this.name} error:`, error);
        await this.audit.log('AGENT_ERROR', { error: String(error) });
      }

      // Wait before next check
      await this.sleep(this.config.checkInterval || 5000);
    }
  }

  stop() {
    this.running = false;
    this.audit.log('AGENT_STOPPED', {});
    console.log(`🛑 Agent ${this.name} stopped`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}