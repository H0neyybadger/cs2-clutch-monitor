#!/usr/bin/env node

/**
 * Network Health Monitor for CS2 Clutch Mode
 * Prevents network interference by monitoring connections
 */

const { execSync } = require('child_process');
const net = require('net');

const MAX_CONNECTIONS = 10;
const CHECK_INTERVAL = 30000; // 30 seconds
const PORTS_TO_MONITOR = [3001, 3002];

let connectionHistory = [];
let lastCheck = Date.now();

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(2000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      resolve(false);
    });
    
    socket.connect(port, '127.0.0.1');
  });
}

function getConnectionCount(port) {
  try {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    return result.split('\n').filter(line => line.trim()).length;
  } catch {
    return 0;
  }
}

function logHealthStatus(port, count, isActive) {
  const timestamp = new Date().toISOString();
  const status = {
    timestamp,
    port,
    connectionCount: count,
    isActive,
    warning: count > MAX_CONNECTIONS
  };
  
  connectionHistory.push(status);
  
  // Keep only last 100 entries
  if (connectionHistory.length > 100) {
    connectionHistory = connectionHistory.slice(-100);
  }
  
  if (status.warning) {
    console.warn(`⚠️  [HEALTH] High connection count on port ${port}: ${count}`);
  } else {
    console.log(`✅ [HEALTH] Port ${port}: ${count} connections, active: ${isActive}`);
  }
  
  return status;
}

async function monitorNetwork() {
  console.log('🔍 Starting network health monitor...');
  console.log(`Monitoring ports: ${PORTS_TO_MONITOR.join(', ')}`);
  console.log(`Max connections per port: ${MAX_CONNECTIONS}`);
  console.log(`Check interval: ${CHECK_INTERVAL / 1000}s`);
  console.log('---');
  
  setInterval(async () => {
    const now = Date.now();
    
    for (const port of PORTS_TO_MONITOR) {
      const isActive = await checkPort(port);
      const count = getConnectionCount(port);
      
      const status = logHealthStatus(port, count, isActive);
      
      // Auto-cleanup if too many connections
      if (count > MAX_CONNECTIONS * 2) {
        console.error(`🚨 [AUTO-CLEANUP] Critical connection count on port ${port}: ${count}`);
        console.log('Stopping Node.js processes...');
        
        try {
          execSync('taskkill /F /IM node.exe', { stdio: 'pipe' });
          console.log('✅ Auto-cleanup completed');
        } catch (error) {
          console.error('❌ Auto-cleanup failed:', error.message);
        }
      }
    }
    
    console.log(`--- Last check: ${new Date().toLocaleTimeString()} ---`);
    
  }, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Network health monitor stopped');
  process.exit(0);
});

// Start monitoring
if (require.main === module) {
  monitorNetwork().catch(console.error);
}

module.exports = { monitorNetwork, checkPort, getConnectionCount };
