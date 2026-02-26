import { BaseAgent, AgentConfig } from './base-agent';
import { NexusWallet } from '../core/wallet';
import { JupiterClient } from '../defi/jupiter';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface SwapOpportunity {
  inputMint: string;
  outputMint: string;
  amount: number;
  expectedOutput: number;
  priceImpact: number;
}

export class TradingAgent extends BaseAgent {
  private jupiter: JupiterClient;
  private minProfitPercent: number;

  constructor(wallet: NexusWallet, config: AgentConfig & { minProfit?: number }) {
    super(wallet, config);
    this.jupiter = new JupiterClient(wallet.connection);
    this.minProfitPercent = config.minProfit || 0.5; // 0.5% minimum
  }

  async evaluate(): Promise<SwapOpportunity | null> {
    // Get quote for SOL -> USDC
    const solBalance = await this.wallet.getBalance();
    
    if (solBalance < 0.01) {
      console.log('Insufficient SOL balance for trading');
      return null;
    }

    const tradeAmount = Math.min(solBalance * 0.1, 0.1) * LAMPORTS_PER_SOL; // 10% of balance or 0.1 SOL
    
    const quote = await this.jupiter.getQuote({
      inputMint: JupiterClient.SOL_MINT,
      outputMint: JupiterClient.USDC_MINT,
      amount: tradeAmount,
      slippage: 0.01 // 1% slippage
    });

    if (!quote) {
      return null;
    }

    // Calculate if profitable (simplified check)
    const priceImpact = quote.priceImpact;
    
    // For demo: we consider it an opportunity if price impact is low
    if (priceImpact < 0.01) { // Less than 1% impact
      const opportunity: SwapOpportunity = {
        inputMint: JupiterClient.SOL_MINT,
        outputMint: JupiterClient.USDC_MINT,
        amount: tradeAmount / LAMPORTS_PER_SOL,
        expectedOutput: quote.outAmount / 1e6, // USDC has 6 decimals
        priceImpact: priceImpact
      };

      await this.audit.log('OPPORTUNITY_FOUND', opportunity);
      return opportunity;
    }

    return null;
  }

  async execute(opportunity: SwapOpportunity) {
    console.log(`💰 Executing swap: ${opportunity.amount} SOL -> USDC`);
    console.log(`   Expected: ${opportunity.expectedOutput} USDC`);
    console.log(`   Price impact: ${(opportunity.priceImpact * 100).toFixed(2)}%`);

    try {
      // Get fresh quote for execution
      const quote = await this.jupiter.getQuote({
        inputMint: opportunity.inputMint,
        outputMint: opportunity.outputMint,
        amount: opportunity.amount * LAMPORTS_PER_SOL,
        slippage: 0.01
      });

      if (!quote) {
        throw new Error('Failed to get execution quote');
      }

      // Build transaction
      const transaction = await this.jupiter.buildSwapTransaction(
        quote,
        this.wallet.publicKey
      );

      if (!transaction) {
        throw new Error('Failed to build swap transaction');
      }

      // Sign and send via wallet (policy checks happen here)
      const signature = await this.wallet.signAndSendTransaction(
        transaction,
        opportunity.amount
      );

      await this.audit.log('SWAP_EXECUTED', {
        signature,
        input: opportunity.amount,
        expectedOutput: opportunity.expectedOutput,
        priceImpact: opportunity.priceImpact
      });

      console.log(`✅ Swap completed: ${signature}`);
    } catch (error) {
      console.error('❌ Swap failed:', error);
      await this.audit.log('SWAP_FAILED', { error: String(error) });
    }
  }
}