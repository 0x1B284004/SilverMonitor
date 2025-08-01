const psList = require('ps-list');
const netstat = require('netstat');
const { promisify } = require('util');

class ProcessManager {
  constructor() {
    this.processes = new Map();
    this.processConnections = new Map();
  }

  async getActiveProcesses() {
    try {
      const processes = await psList();
      
      // Filtrer et enrichir les processus
      const activeProcesses = processes
        .filter(process => process.pid > 0)
        .map(process => ({
          pid: process.pid,
          name: process.name,
          cmd: process.cmd,
          cpu: process.cpu,
          memory: process.memory,
          ppid: process.ppid,
          connections: []
        }));

      // Enrichir avec les connexions réseau
      await this.enrichProcessesWithConnections(activeProcesses);
      
      return activeProcesses;
    } catch (error) {
      console.error('Erreur lors de la récupération des processus:', error);
      return [];
    }
  }

  async enrichProcessesWithConnections(processes) {
    return new Promise((resolve) => {
      const processMap = new Map(processes.map(p => [p.pid, p]));
      
      netstat({
        filter: {
          state: 'ESTABLISHED'
        }
      }, (data) => {
        const pid = data.pid;
        if (pid && processMap.has(pid)) {
          const process = processMap.get(pid);
          process.connections.push({
            localAddress: data.local_address,
            localPort: data.local_port,
            remoteAddress: data.remote_address,
            remotePort: data.remote_port,
            protocol: data.protocol,
            state: data.state
          });
        }
      }, () => {
        resolve();
      });
    });
  }

  async getProcessById(pid) {
    try {
      const processes = await psList();
      const process = processes.find(p => p.pid === pid);
      
      if (process) {
        const enrichedProcess = {
          pid: process.pid,
          name: process.name,
          cmd: process.cmd,
          cpu: process.cpu,
          memory: process.memory,
          ppid: process.ppid,
          connections: await this.getProcessConnections(pid)
        };
        
        return enrichedProcess;
      }
      
      return null;
    } catch (error) {
      console.error(`Erreur lors de la récupération du processus ${pid}:`, error);
      return null;
    }
  }

  async getProcessConnections(pid) {
    return new Promise((resolve) => {
      const connections = [];
      
      netstat({
        filter: {
          pid: pid
        }
      }, (data) => {
        connections.push({
          localAddress: data.local_address,
          localPort: data.local_port,
          remoteAddress: data.remote_address,
          remotePort: data.remote_port,
          protocol: data.protocol,
          state: data.state
        });
      }, () => {
        resolve(connections);
      });
    });
  }

  async getProcessesByPort(port) {
    try {
      const processes = await this.getActiveProcesses();
      return processes.filter(process => 
        process.connections.some(conn => 
          conn.localPort === port || conn.remotePort === port
        )
      );
    } catch (error) {
      console.error(`Erreur lors de la recherche de processus par port ${port}:`, error);
      return [];
    }
  }

  async getProcessesByProtocol(protocol) {
    try {
      const processes = await this.getActiveProcesses();
      return processes.filter(process => 
        process.connections.some(conn => 
          conn.protocol.toLowerCase() === protocol.toLowerCase()
        )
      );
    } catch (error) {
      console.error(`Erreur lors de la recherche de processus par protocole ${protocol}:`, error);
      return [];
    }
  }

  async getProcessesByDomain(domain) {
    try {
      const processes = await this.getActiveProcesses();
      return processes.filter(process => 
        process.connections.some(conn => 
          conn.remoteAddress && conn.remoteAddress.includes(domain)
        )
      );
    } catch (error) {
      console.error(`Erreur lors de la recherche de processus par domaine ${domain}:`, error);
      return [];
    }
  }

  async getNetworkStatistics() {
    try {
      const processes = await this.getActiveProcesses();
      
      const stats = {
        totalProcesses: processes.length,
        processesWithConnections: processes.filter(p => p.connections.length > 0).length,
        totalConnections: processes.reduce((sum, p) => sum + p.connections.length, 0),
        protocols: {},
        ports: {},
        domains: new Set()
      };

      // Analyser les protocoles
      processes.forEach(process => {
        process.connections.forEach(conn => {
          // Protocoles
          const protocol = conn.protocol || 'Unknown';
          stats.protocols[protocol] = (stats.protocols[protocol] || 0) + 1;
          
          // Ports
          if (conn.localPort) {
            stats.ports[conn.localPort] = (stats.ports[conn.localPort] || 0) + 1;
          }
          if (conn.remotePort) {
            stats.ports[conn.remotePort] = (stats.ports[conn.remotePort] || 0) + 1;
          }
          
          // Domaines (extrait du nom de domaine si disponible)
          if (conn.remoteAddress && !this.isPrivateIP(conn.remoteAddress)) {
            stats.domains.add(conn.remoteAddress);
          }
        });
      });

      stats.domains = Array.from(stats.domains);
      
      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return null;
    }
  }

  async monitorProcess(pid, callback) {
    try {
      const process = await this.getProcessById(pid);
      
      if (!process) {
        throw new Error(`Processus ${pid} non trouvé`);
      }

      console.log(`🔍 Monitoring du processus: ${process.name} (PID: ${pid})`);
      
      // Monitorer les changements de connexions
      this.startProcessMonitoring(pid, callback);
      
      return process;
    } catch (error) {
      console.error(`Erreur lors du monitoring du processus ${pid}:`, error);
      throw error;
    }
  }

  startProcessMonitoring(pid, callback) {
    // Monitorer les nouvelles connexions du processus
    netstat({
      filter: {
        pid: pid
      }
    }, (data) => {
      const connection = {
        localAddress: data.local_address,
        localPort: data.local_port,
        remoteAddress: data.remote_address,
        remotePort: data.remote_port,
        protocol: data.protocol,
        state: data.state,
        timestamp: new Date()
      };

      if (callback) {
        callback('connection', connection);
      }
    });
  }

  isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./
    ];
    
    return privateRanges.some(range => range.test(ip));
  }

  async getTopProcessesByConnections(limit = 10) {
    try {
      const processes = await this.getActiveProcesses();
      
      return processes
        .filter(p => p.connections.length > 0)
        .sort((a, b) => b.connections.length - a.connections.length)
        .slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la récupération des processus les plus actifs:', error);
      return [];
    }
  }

  async getTopProcessesByMemory(limit = 10) {
    try {
      const processes = await this.getActiveProcesses();
      
      return processes
        .filter(p => p.memory > 0)
        .sort((a, b) => b.memory - a.memory)
        .slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la récupération des processus par mémoire:', error);
      return [];
    }
  }

  async getTopProcessesByCPU(limit = 10) {
    try {
      const processes = await this.getActiveProcesses();
      
      return processes
        .filter(p => p.cpu > 0)
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, limit);
    } catch (error) {
      console.error('Erreur lors de la récupération des processus par CPU:', error);
      return [];
    }
  }

  formatProcessInfo(process) {
    return {
      pid: process.pid,
      name: process.name,
      cmd: process.cmd,
      cpu: `${process.cpu.toFixed(1)}%`,
      memory: `${(process.memory / 1024 / 1024).toFixed(1)} MB`,
      connections: process.connections.length,
      ppid: process.ppid
    };
  }
}

module.exports = ProcessManager; 