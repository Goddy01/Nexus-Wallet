import { db } from '../db/sqlite';

export class AuditLogger {
  private walletId?: string;
  private agentId?: string;

  constructor(walletId?: string, agentId?: string) {
    this.walletId = walletId;
    this.agentId = agentId;
  }

  async log(action: string, details: any) {
    const timestamp = Date.now();
    
    const stmt = db.prepare(`
      INSERT INTO audit_logs (wallet_id, agent_id, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      this.walletId || null,
      this.agentId || null,
      action,
      JSON.stringify(details),
      timestamp
    );

    console.log(`[AUDIT] ${action}: ${JSON.stringify(details)}`);
  }

  async query(filters: { walletId?: string; agentId?: string; action?: string; limit?: number }) {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.walletId) {
      query += ' AND wallet_id = ?';
      params.push(filters.walletId);
    }

    if (filters.agentId) {
      query += ' AND agent_id = ?';
      params.push(filters.agentId);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params);
  }
}