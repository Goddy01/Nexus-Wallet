import { 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction, 
    SystemProgram,
    LAMPORTS_PER_SOL 
  } from '@solana/web3.js';
  import { PolicyEngine, PolicyConfig } from './policy';
  import { AuditLogger } from './audit';
  import { db } from '../db/sqlite';
  import { randomUUID } from 'crypto';
  
  // For devnet testing without Turnkey (we'll add Turnkey later)
  export class NexusWallet {
    id: string;
    agentId: string;
    keypair: Keypair;
    publicKey: PublicKey;
    policy: PolicyEngine;
    audit: AuditLogger;
    connection: Connection;
  
    constructor(agentId: string, policyConfig: PolicyConfig) {
      this.id = randomUUID();
      this.agentId = agentId;
      this.keypair = Keypair.generate();
      this.publicKey = this.keypair.publicKey;
      this.policy = new PolicyEngine(policyConfig);
      this.audit = new AuditLogger(this.id, agentId);
      this.connection = new Connection(process.env.SOLANA_RPC_URL!);
    }
  
    async initialize() {
      // Save to database
      const stmt = db.prepare(`
        INSERT INTO wallets (id, agent_id, turnkey_wallet_id, public_key, policy, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
  
      stmt.run(
        this.id,
        this.agentId,
        'local-keypair', // Will be 'turnkey' later
        this.publicKey.toBase58(),
        JSON.stringify(this.policy.getConfig()),
        Date.now(),
        Date.now()
      );
  
      await this.audit.log('WALLET_CREATED', {
        publicKey: this.publicKey.toBase58(),
        policy: this.policy.getConfig()
      });
  
      console.log(`✅ Wallet created: ${this.publicKey.toBase58()}`);
    }
  
    async getBalance(): Promise<number> {
      const balance = await this.connection.getBalance(this.publicKey);
      return balance / LAMPORTS_PER_SOL;
    }
  
    async signAndSendTransaction(
      transaction: Transaction, 
      estimatedValue: number = 0
    ): Promise<string> {
      // Policy check
      const validation = this.policy.validate(transaction, estimatedValue);
      if (!validation.valid) {
        await this.audit.log('TRANSACTION_REJECTED', {
          reason: validation.reason,
          estimatedValue
        });
        throw new Error(`Policy violation: ${validation.reason}`);
      }
  
      // Sign
      transaction.sign(this.keypair);
      
      // Send
      const signature = await this.connection.sendTransaction(transaction, [this.keypair]);
      
      // Confirm
      await this.connection.confirmTransaction(signature, 'confirmed');
  
      // Record spend
      this.policy.recordSpend(estimatedValue);
  
      // Audit
      await this.audit.log('TRANSACTION_SENT', {
        signature,
        estimatedValue,
        recipient: transaction.instructions[0]?.keys[0]?.pubkey?.toBase58()
      });
  
      console.log(`✅ Transaction sent: ${signature}`);
      return signature;
    }
  
    async transfer(to: string, amount: number): Promise<string> {
      const recipient = new PublicKey(to);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.publicKey,
          toPubkey: recipient,
          lamports: amount * LAMPORTS_PER_SOL
        })
      );
  
      return this.signAndSendTransaction(transaction, amount);
    }
  
    async emergencyFreeze(reason: string) {
      this.policy.freeze();
      await this.audit.log('EMERGENCY_FREEZE', { reason });
      console.log(`🛑 Wallet frozen: ${reason}`);
    }
  
    // Static method to load existing wallet
    static load(agentId: string): NexusWallet | null {
      const stmt = db.prepare('SELECT * FROM wallets WHERE agent_id = ? AND status = ?');
      const row = stmt.get(agentId, 'active') as any;
  
      if (!row) return null;
  
      // Recreate from database
      const wallet = new NexusWallet(agentId, JSON.parse(row.policy));
      wallet.id = row.id;
      // Note: In real implementation, we'd restore keypair from secure storage
      return wallet;
    }
  }