import 'dotenv/config';
import { initDatabase } from './src/db/sqlite';
import { NexusWallet } from './src/core/wallet';

async function test() {
  console.log('RPC URL:', process.env.SOLANA_RPC_URL);  // Debug line
  
  initDatabase();
  
  // Create wallet
  const wallet = new NexusWallet('test-agent', {
    spendingLimits: {
      perTransaction: 1,
      perHour: 10,
      perDay: 100
    }
  });
  
  await wallet.initialize();
  
  // Check balance (will be 0 on devnet)
  const balance = await wallet.getBalance();
  console.log(`Balance: ${balance} SOL`);
  
  // Try to get devnet airdrop
  console.log('Requesting airdrop...');
  try {
    const connection = wallet.connection;
    await connection.requestAirdrop(wallet.publicKey, 2 * 1000000000); // 2 SOL
    await new Promise(r => setTimeout(r, 2000)); // Wait for confirmation
    
    const newBalance = await wallet.getBalance();
    console.log(`New balance: ${newBalance} SOL`);
  } catch (e) {
    console.log('Airdrop failed (rate limited?), continuing...');
  }
}

test().catch(console.error);