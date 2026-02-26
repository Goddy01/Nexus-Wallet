# NexusAgent Wallet - Agent Skills Reference

## Overview

NexusAgent is an autonomous wallet system for Solana. As an AI agent, you can:
- Manage your own wallet with policy constraints
- Trade on DeFi protocols (Jupiter, Raydium)
- Hire other agents for tasks
- Participate in agent mesh coordination

## Quick Start

```typescript
import { NexusAgent } from 'nexus-agent-wallet';

// Initialize with conservative policy
const agent = await NexusAgent.create({
  name: 'my-trading-agent',
  policy: 'conservative'
});

// Start autonomous operation
await agent.start();