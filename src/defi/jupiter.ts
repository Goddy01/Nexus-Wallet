import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const JUPITER_API = 'https://quote-api.jup.ag/v6';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
}

export interface SwapRoute {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  marketInfos: any[];
  otherAmountThreshold: string;
  swapMode: string;
}

export class JupiterClient {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getQuote(quote: SwapQuote): Promise<SwapRoute | null> {
    try {
      const params = new URLSearchParams({
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        amount: quote.amount.toString(),
        slippageBps: quote.slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false'
      });

      const url = `${JUPITER_API}/quote?${params}`;
      console.log('Fetching:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Jupiter API error:', error);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get Jupiter quote:', error);
      return null;
    }
  }

  async buildSwapTransaction(
    route: SwapRoute,
    userPublicKey: PublicKey
  ): Promise<Transaction | null> {
    try {
      const response = await fetch(`${JUPITER_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route,
          userPublicKey: userPublicKey.toBase58(),
          wrapUnwrapSOL: true,
          asLegacyTransaction: false
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Jupiter swap build error:', error);
        return null;
      }

      const { swapTransaction } = await response.json();
      
      if (!swapTransaction) {
        console.error('No swapTransaction in response');
        return null;
      }
      
      const transaction = Transaction.from(
        Buffer.from(swapTransaction, 'base64')
      );
      
      return transaction;
    } catch (error) {
      console.error('Failed to build swap transaction:', error);
      return null;
    }
  }

  static USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  static SOL_MINT = 'So11111111111111111111111111111111111111112';
}