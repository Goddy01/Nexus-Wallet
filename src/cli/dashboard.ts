import 'dotenv/config';
import blessed from 'blessed';
import { db } from '../db/sqlite';
import { initDatabase } from '../db/sqlite';

// Initialize database
initDatabase();

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'NexusAgent Wallet Dashboard'
});

// Create layout boxes
const headerBox = blessed.box({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{center}🚀 NexusAgent Wallet - Live Dashboard{/center}',
  tags: true,
  border: { type: 'line' },
  style: { fg: 'cyan', border: { fg: 'blue' } }
});

const agentList = blessed.list({
  top: 3,
  left: 0,
  width: '40%',
  height: '50%',
  label: ' Active Agents ',
  border: { type: 'line' },
  style: { 
    selected: { bg: 'blue', fg: 'white' },
    border: { fg: 'green' }
  },
  keys: true,
  interactive: true
});

const statsBox = blessed.box({
  top: 3,
  left: '40%',
  width: '60%',
  height: '50%',
  label: ' Network Stats ',
  border: { type: 'line' },
  content: 'Loading stats...',
  style: { border: { fg: 'yellow' } }
});

const logBox = blessed.log({
  top: '53%',
  left: 0,
  width: '100%',
  height: '47%',
  label: ' Activity Log ',
  border: { type: 'line' },
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  style: { border: { fg: 'magenta' } }
});

// Add to screen
screen.append(headerBox);
screen.append(agentList);
screen.append(statsBox);
screen.append(logBox);

// Focus on agent list
agentList.focus();

// Update functions
function updateAgents() {
  try {
    const stmt = db.prepare(`
      SELECT a.id, a.name, a.status, w.public_key, a.last_active
      FROM agents a
      LEFT JOIN wallets w ON a.wallet_id = w.id
      ORDER BY a.created_at DESC
    `);
    const agents = stmt.all();
    
    const items = agents.map((a: any) => {
      const status = a.status === 'running' ? '{green-fg}●{/green-fg}' : '{red-fg}○{/red-fg}';
      return `${status} ${a.name} (${a.id.substring(0, 8)}...)`;
    });
    
    agentList.setItems(items.length ? items : ['No agents yet']);
    screen.render();
  } catch (e) {
    logBox.log(`Error loading agents: ${e}`);
  }
}

function updateStats() {
  try {
    const agentCount = (db.prepare('SELECT COUNT(*) as count FROM agents').get() as any).count;
    const walletCount = (db.prepare('SELECT COUNT(*) as count FROM wallets').get() as any).count;
    const txCount = (db.prepare('SELECT COUNT(*) as count FROM transactions').get() as any).count;
    
    const recentTx = db.prepare(`
      SELECT * FROM transactions 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();

    let content = `
    Agents: ${agentCount} | Wallets: ${walletCount} | Transactions: ${txCount}
    
    Recent Activity:
    `;

    recentTx.forEach((tx: any) => {
      const time = new Date(tx.created_at).toLocaleTimeString();
      content += `\n    ${time} - ${tx.type} (${tx.status})`;
    });

    statsBox.setContent(content);
    screen.render();
  } catch (e) {
    // Stats might fail if tables empty
  }
}

// Key bindings
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

screen.key(['r'], () => {
  logBox.log('Refreshing...');
  updateAgents();
  updateStats();
});

screen.key(['c'], () => {
  // Create agent shortcut
  logBox.log('{cyan-fg}Create agent: Run `npm run agent:create -- --name my-agent`{/cyan-fg}');
});

// Auto-update every 2 seconds
setInterval(() => {
  updateAgents();
  updateStats();
}, 2000);

// Initial load
updateAgents();
updateStats();
logBox.log('{green-fg}Dashboard started. Press Q to quit, R to refresh, C for create help{/green-fg}');

// Render screen
screen.render();