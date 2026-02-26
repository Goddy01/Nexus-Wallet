import 'dotenv/config';
import { Command } from 'commander';
import { NexusWallet } from '../core/wallet';
import { initDatabase } from '../db/sqlite';
import { spawn } from 'child_process';
import { db } from '../db/sqlite';

const program = new Command();

program
  .name('nexus-agent')
  .description('NexusAgent Wallet CLI')
  .version('1.0.0');

program
  .command('create-agent')
  .description('Create a new agent with wallet')
  .option('-n, --name <name>', 'Agent name', 'unnamed-agent')
  .option('-p, --policy <policy>', 'Policy file', 'default')
  .action(async (options) => {
    initDatabase();
    
    const agentId = `${options.name}-${Date.now()}`;
    
    const policy = {
      spendingLimits: {
        perTransaction: 0.1,
        perHour: 1,
        perDay: 10
      }
    };

    const wallet = new NexusWallet(agentId, policy);
    await wallet.initialize();

    // Save agent record
    const stmt = db.prepare(`
      INSERT INTO agents (id, name, wallet_id, status, config, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      agentId,
      options.name,
      wallet.id,
      'created',
      JSON.stringify({ policy }),
      Date.now()
    );

    console.log(`✅ Agent created:`);
    console.log(`   ID: ${agentId}`);
    console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`   To start: npm run agent:start -- --name ${agentId}`);
  });

program
  .command('start-agent')
  .description('Start an agent')
  .option('-n, --name <name>', 'Agent ID', 'required')
  .action(async (options) => {
    if (!options.name || options.name === 'required') {
      console.error('❌ Please provide --name');
      process.exit(1);
    }

    console.log(`🚀 Starting agent ${options.name}...`);

    // Use PM2 to start
    const pm2 = spawn('pm2', [
      'start',
      'ecosystem.config.js',
      '--name', `agent-${options.name}`,
      '--env', `AGENT_ID=${options.name}`
    ], {
      stdio: 'inherit',
      shell: true
    });

    pm2.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Agent started. Run `npm run dashboard` to monitor.');
      }
    });
  });

program
  .command('list-agents')
  .description('List all agents')
  .action(() => {
    initDatabase();
    
    const stmt = db.prepare('SELECT * FROM agents ORDER BY created_at DESC');
    const agents = stmt.all();

    console.log('\n📋 Agents:');
    console.table(agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      created: new Date(a.created_at).toLocaleDateString()
    })));
  });

program
  .command('wallet-balance <agentId>')
  .description('Check wallet balance')
  .action(async (agentId) => {
    initDatabase();
    
    const wallet = NexusWallet.load(agentId);
    if (!wallet) {
      console.error('❌ Wallet not found');
      return;
    }

    const balance = await wallet.getBalance();
    console.log(`💰 Balance for ${agentId}: ${balance} SOL`);
  });

program.parse();