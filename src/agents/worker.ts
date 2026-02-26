import 'dotenv/config';
import { NexusWallet } from '../core/wallet';
import { TradingAgent } from './trading-agent';
import { db, initDatabase } from '../db/sqlite';

const agentId = process.env.AGENT_ID || `worker-${process.pid}`;

async function startWorker() {
  console.log(`🚀 Starting worker for agent: ${agentId}`);
  
  initDatabase();

  // Load or create wallet
  let wallet = NexusWallet.load(agentId);
  
  if (!wallet) {
    console.log('Creating new wallet...');
    wallet = new NexusWallet(agentId, {
      spendingLimits: {
        perTransaction: 0.1,
        perHour: 1,
        perDay: 10
      }
    });
    await wallet.initialize();
  }

  // Create and start agent
  const agent = new TradingAgent(wallet, {
    name: `Trader-${agentId}`,
    strategy: 'arbitrage',
    checkInterval: 10000, // 10 seconds
    minProfit: 0.005 // 0.5%
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    agent.stop();
    process.exit(0);
  });

  await agent.start();
}

startWorker().catch(error => {
  console.error('Worker failed:', error);
  process.exit(1);
});