const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const Database = require('./database');
// Try to load Windows network monitor, fallback to simulator
let NetworkMonitor;
try {
    NetworkMonitor = require('./network-monitor-windows');
    console.log('✅ Windows network monitoring loaded successfully');
} catch (error) {
    console.log('⚠️ Windows network monitoring not available, using simulator');
    NetworkMonitor = require('./network-simulator');
}

class WebServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server);
    this.database = new Database();
    this.networkMonitor = new NetworkMonitor();
    this.isRunning = false;
    this.currentMode = 'global'; // 'global' or 'process'
    this.targetProcess = null;
  }

  async start(port = 3000) {
    try {
      // Initialize database
      await this.database.init();
      
      // Setup middlewares
      this.setupMiddlewares();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup WebSockets
      this.setupWebSockets();
      
      // Start server
      this.server.listen(port, () => {
        console.log(`🌐 Web interface started on http://localhost:${port}`);
        this.isRunning = true;
      });

      // Start real network monitoring in background
      this.startBackgroundMonitoring();

    } catch (error) {
      console.error('❌ Error starting web server:', error);
      throw error;
    }
  }

  setupMiddlewares() {
    // Middleware for JSON parsing
    this.app.use(express.json());
    
    // Middleware for serving static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Middleware for logging requests
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Main route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // API Routes
    this.setupAPIRoutes();
  }

  setupAPIRoutes() {
    // Route for getting general statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await this.getGeneralStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting recent packets
    this.app.get('/api/packets', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const packets = await this.database.getPackets(limit, offset);
        res.json(packets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting recent connections
    this.app.get('/api/connections', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const connections = await this.database.getConnections(limit, offset);
        res.json(connections);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting active processes
    this.app.get('/api/processes', async (req, res) => {
      try {
        const processes = await this.database.getProcesses();
        res.json(processes);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting protocol statistics
    this.app.get('/api/protocols', async (req, res) => {
      try {
        const protocols = await this.database.getProtocolStats();
        res.json(protocols);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting port statistics
    this.app.get('/api/ports', async (req, res) => {
      try {
        const ports = await this.database.getPortStats();
        res.json(ports);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting most active domains
    this.app.get('/api/domains', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 10;
        const domains = await this.database.getTopDomains(limit);
        res.json(domains);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting recent activity
    this.app.get('/api/activity', async (req, res) => {
      try {
        const minutes = parseInt(req.query.minutes) || 5;
        const activity = await this.database.getRecentActivity(minutes);
        res.json(activity);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for getting process statistics
    this.app.get('/api/process/:pid', async (req, res) => {
      try {
        const pid = parseInt(req.params.pid);
        const stats = await this.database.getProcessStats(pid);
        if (stats) {
          res.json(stats);
        } else {
          res.status(404).json({ error: 'Process not found' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for starting process monitoring
    this.app.post('/api/monitor/process/:pid', async (req, res) => {
      try {
        const pid = parseInt(req.params.pid);
        console.log(`🎯 Starting monitoring for process ${pid}`);
        res.json({ message: `Monitoring started for process ${pid}` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Route for stopping monitoring
    this.app.post('/api/monitor/stop', async (req, res) => {
      try {
        console.log('🛑 Monitoring stopped');
        res.json({ message: 'Monitoring stopped' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupWebSockets() {
    this.io.on('connection', (socket) => {
      console.log('🔌 New client connected:', socket.id);
      
      // Send initial data
      this.sendInitialData(socket);
      
      // Handle subscriptions
      socket.on('subscribe', (data) => {
        this.handleSubscription(socket, data);
      });
      
      // Handle mode switching
      socket.on('startGlobalMonitoring', () => {
        console.log('🌐 Starting global monitoring');
        this.startGlobalMonitoring();
      });
      
      socket.on('startProcessMonitoring', (data) => {
        console.log('🎯 Starting process monitoring for PID:', data.pid);
        this.startProcessMonitoring(data.pid);
      });
      
      socket.on('getProcesses', async () => {
        try {
          const processes = await this.getActiveProcesses();
          
          // Filter processes based on current mode
          if (this.currentMode === 'process' && this.targetProcess) {
            const targetProcess = processes.find(p => p.pid === this.targetProcess);
            socket.emit('processesList', targetProcess ? [targetProcess] : []);
          } else {
            socket.emit('processesList', processes);
          }
        } catch (error) {
          console.error('Error getting processes:', error);
          socket.emit('error', { message: 'Failed to get processes' });
        }
      });
      
      socket.on('getProcessInfo', async (data) => {
        try {
          const pid = parseInt(data.pid);
          const processes = await this.getActiveProcesses();
          const process = processes.find(p => p.pid === pid);
          
          if (process) {
            socket.emit('processInfo', process);
          } else {
            socket.emit('processInfo', null);
          }
        } catch (error) {
          console.error('Error getting process info:', error);
          socket.emit('error', { message: 'Failed to get process info' });
        }
      });
      
      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });
    });

    // Setup network monitor event handlers
    this.setupNetworkMonitorEvents();
  }

  setupNetworkMonitorEvents() {
    // Handle packets from network monitor
    this.networkMonitor.on('packet', async (packet) => {
      try {
        await this.database.savePacket(packet);
        this.io.emit('packet', packet);
      } catch (error) {
        console.error('Error handling packet:', error);
      }
    });

    // Handle connections from network monitor
    this.networkMonitor.on('connections', async (connections) => {
      try {
        for (const connection of connections) {
          await this.database.saveConnection(connection);
          this.io.emit('connection', connection);
        }
      } catch (error) {
        console.error('Error handling connections:', error);
      }
    });

    // Handle individual connections from network monitor
    this.networkMonitor.on('connection', async (connection) => {
      try {
        await this.database.saveConnection(connection);
        this.io.emit('connection', connection);
      } catch (error) {
        console.error('Error handling individual connection:', error);
      }
    });

    // Handle processes from network monitor
    this.networkMonitor.on('processes', async (processes) => {
      try {
        for (const process of processes) {
          await this.database.saveProcess(process);
        }
        this.io.emit('processes', processes);
      } catch (error) {
        console.error('Error handling processes:', error);
      }
    });

    // Handle domains from network monitor
    this.networkMonitor.on('domains', async (domains) => {
      try {
        this.io.emit('domains', domains);
      } catch (error) {
        console.error('Error handling domains:', error);
      }
    });
  }

  async sendInitialData(socket) {
    try {
      const stats = await this.getGeneralStats();
      socket.emit('stats', stats);
      
      const protocols = await this.database.getProtocolStats();
      socket.emit('protocols', protocols);
      
      const ports = await this.database.getPortStats();
      socket.emit('ports', ports);
      
      const domains = await this.database.getTopDomains(10);
      socket.emit('domains', domains);
      
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  handleSubscription(socket, data) {
    console.log('📡 Subscription received:', data);
    // Here we could handle different types of subscriptions
  }

  startGlobalMonitoring() {
    // Stop any existing monitoring
    if (this.networkMonitor) {
      this.networkMonitor.stop();
    }
    
    // Update mode
    this.currentMode = 'global';
    this.targetProcess = null;
    
    // Start global monitoring
    this.networkMonitor.start().catch(error => {
      console.error('❌ Error starting global monitoring:', error);
    });
    
    // Clear previous data
    this.database.clearData();
    
    console.log('🌐 Global monitoring started');
  }

  startProcessMonitoring(pid) {
    // Stop any existing monitoring
    if (this.networkMonitor) {
      this.networkMonitor.stop();
    }
    
    // Update mode
    this.currentMode = 'process';
    this.targetProcess = pid;
    
    // Configure network monitor for specific process
    this.networkMonitor.setTargetProcess(pid);
    
    // Start process monitoring
    this.networkMonitor.start().catch(error => {
      console.error('❌ Error starting process monitoring:', error);
    });
    
    // Clear previous data
    this.database.clearData();
    
    console.log(`🎯 Process monitoring started for PID: ${pid}`);
  }

  async getActiveProcesses() {
    try {
      const psList = require('ps-list');
      const processes = await psList();
      
      // Return ALL processes, no filtering
      return processes.map(proc => ({
        pid: proc.pid,
        name: proc.name,
        cpu: proc.cpu,
        memory: proc.memory,
        connections: 0, // Will be updated separately
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('Error getting active processes:', error);
      return [];
    }
  }

  startBackgroundMonitoring() {
    // Start real network monitoring
    this.networkMonitor.start().catch(error => {
      console.error('❌ Error starting real network monitoring:', error);
      console.log('💡 Make sure you have administrator privileges');
    });
    
    // Listen to real network monitor events
    this.networkMonitor.on('packet', async (packet) => {
      await this.database.savePacket(packet);
      this.io.emit('packet', packet);
    });
    
    this.networkMonitor.on('connections', async (connections) => {
      for (const connection of connections) {
        await this.database.saveConnection(connection);
      }
      this.io.emit('connections', connections);
    });
    
    this.networkMonitor.on('processes', async (processes) => {
      for (const process of processes) {
        await this.database.saveProcess(process);
      }
      this.io.emit('processes', processes);
    });
    
        // Send statistics periodically
    setInterval(async () => {
      try {
        const stats = await this.getGeneralStats();
        this.io.emit('stats', stats);
      } catch (error) {
        console.error('Error sending stats:', error);
      }
    }, 2000);
  }

  async getGeneralStats() {
    try {
      const dbStats = await this.database.getGeneralStats();
      const monitorStats = this.networkMonitor.getStatistics();
      
      return {
        totalPackets: dbStats.totalPackets,
        totalConnections: dbStats.totalConnections,
        activeProcesses: dbStats.activeProcesses,
        uniqueDomains: dbStats.uniqueDomains,
        protocols: dbStats.protocols,
        ports: dbStats.ports,
        isMonitoring: monitorStats.isRunning,
        interfaces: monitorStats.interfaces
      };
    } catch (error) {
      console.error('Error getting general statistics:', error);
      return {
        totalPackets: 0,
        totalConnections: 0,
        activeProcesses: 0,
        uniqueDomains: 0,
        protocols: 0,
        ports: 0,
        isMonitoring: false,
        interfaces: 0
      };
    }
  }

  async stop() {
    if (this.networkMonitor) {
      this.networkMonitor.stop();
    }
    
    if (this.database) {
      await this.database.close();
    }
    
    if (this.server) {
      this.server.close();
    }
    
    this.isRunning = false;
    console.log('🛑 Web server stopped');
  }
}

function start() {
  const server = new WebServer();
  server.start(process.env.PORT || 3000);
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping server...');
    await server.stop();
    process.exit(0);
  });
}

module.exports = { WebServer, start };

// Start the server if this file is run directly
if (require.main === module) {
  start();
} 