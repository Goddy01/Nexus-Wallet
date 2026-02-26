import { db } from '../db/sqlite';
import { EventEmitter } from 'events';

export interface Task {
  id: string;
  type: string;
  description: string;
  budget: number;
  requirements: string[];
  milestones: Milestone[];
}

export interface Milestone {
  description: string;
  payment: number;
  verification: string;
}

export interface Escrow {
  id: string;
  employerId: string;
  employeeId: string;
  amount: number;
  status: 'pending' | 'funded' | 'completed' | 'disputed';
  milestones: Milestone[];
  currentMilestone: number;
}

export class MeshCoordinator extends EventEmitter {
  async createTask(
    employerId: string,
    task: Omit<Task, 'id'>
  ): Promise<string> {
    const taskId = `task-${Date.now()}`;
    
    const stmt = db.prepare(`
      INSERT INTO tasks (id, employer_id, type, description, budget, requirements, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      taskId,
      employerId,
      task.type,
      task.description,
      task.budget,
      JSON.stringify(task.requirements),
      'open',
      Date.now()
    );

    this.emit('task:created', { taskId, employerId, task });
    return taskId;
  }

  async findAgentForTask(taskId: string): Promise<string | null> {
    // Simplified: Find any available agent (not the employer)
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    
    const availableAgent = db.prepare(`
      SELECT id FROM agents 
      WHERE id != ? AND status = 'running'
      ORDER BY RANDOM()
      LIMIT 1
    `).get(task.employer_id) as any;

    return availableAgent?.id || null;
  }

  async createEscrow(
    employerId: string,
    employeeId: string,
    amount: number,
    milestones: Milestone[]
  ): Promise<string> {
    const escrowId = `escrow-${Date.now()}`;
    
    const stmt = db.prepare(`
      INSERT INTO escrows (id, employer_agent_id, employee_agent_id, amount, milestones, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      escrowId,
      employerId,
      employeeId,
      amount,
      JSON.stringify(milestones),
      'pending',
      Date.now()
    );

    this.emit('escrow:created', { escrowId, employerId, employeeId, amount });
    return escrowId;
  }

  async fundEscrow(escrowId: string): Promise<boolean> {
    const escrow = db.prepare('SELECT * FROM escrows WHERE id = ?').get(escrowId) as any;
    
    if (!escrow) return false;

    // In real implementation: Transfer funds to escrow account
    // For demo: Just mark as funded
    db.prepare('UPDATE escrows SET status = ? WHERE id = ?').run('funded', escrowId);
    
    this.emit('escrow:funded', { escrowId });
    return true;
  }

  async completeMilestone(escrowId: string, milestoneIndex: number): Promise<boolean> {
    const escrow = db.prepare('SELECT * FROM escrows WHERE id = ?').get(escrowId) as any;
    
    if (!escrow || escrow.status !== 'funded') return false;

    const milestones = JSON.parse(escrow.milestones);
    
    if (milestoneIndex >= milestones.length) return false;

    // Mark milestone complete
    milestones[milestoneIndex].completed = true;
    
    // Release payment for this milestone
    const payment = milestones[milestoneIndex].payment;
    
    // In real implementation: Transfer payment to employee
    console.log(`💸 Releasing ${payment} SOL for milestone ${milestoneIndex}`);

    // Check if all milestones complete
    const allComplete = milestones.every((m: any) => m.completed);
    
    if (allComplete) {
      db.prepare('UPDATE escrows SET status = ?, completed_at = ? WHERE id = ?')
        .run('completed', Date.now(), escrowId);
    } else {
      db.prepare('UPDATE escrows SET milestones = ? WHERE id = ?')
        .run(JSON.stringify(milestones), escrowId);
    }

    this.emit('milestone:completed', { escrowId, milestoneIndex, payment });
    return true;
  }
}

// Run if called directly
if (require.main === module) {
  console.log('🕸️  Starting Mesh Coordinator...');
  const coordinator = new MeshCoordinator();
  
  // Keep process alive
  setInterval(() => {
    console.log('Coordinator heartbeat...');
  }, 30000);
}