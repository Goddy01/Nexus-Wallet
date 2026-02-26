module.exports = {
    apps: [
      {
        name: 'nexus-coordinator',
        script: './src/mesh/coordinator.ts',
        interpreter: 'tsx',
        instances: 1,
        autorestart: true,
        max_memory_restart: '500M',
        env: {
          NODE_ENV: 'development'
        }
      },
      {
        name: 'nexus-agent',
        script: './src/agents/worker.ts',
        interpreter: 'tsx',
        instances: 1,
        autorestart: true,
        max_memory_restart: '300M',
        env: {
          NODE_ENV: 'development',
          AGENT_ID: 'default-agent'
        }
      }
    ]
  };