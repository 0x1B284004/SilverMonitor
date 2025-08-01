const EventEmitter = require('events');

class NetworkSimulator extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.simulationInterval = null;
        this.packetCount = 0;
        this.connectionCount = 0;
        this.processCount = 0;
        this.targetProcess = null; // For process-specific monitoring
        
        // Simulated data
        this.simulatedProcesses = [
            { name: 'chrome.exe', pid: 1234, cpu: 15.2, memory: 1024000 },
            { name: 'firefox.exe', pid: 5678, cpu: 8.7, memory: 512000 },
            { name: 'discord.exe', pid: 9012, cpu: 12.3, memory: 768000 },
            { name: 'spotify.exe', pid: 3456, cpu: 5.1, memory: 256000 },
            { name: 'steam.exe', pid: 7890, cpu: 20.8, memory: 2048000 },
            { name: 'code.exe', pid: 1111, cpu: 3.2, memory: 512000 },
            { name: 'explorer.exe', pid: 2222, cpu: 1.5, memory: 128000 },
            { name: 'svchost.exe', pid: 3333, cpu: 2.1, memory: 256000 }
        ];
        
        this.simulatedDomains = [
            'google.com', 'youtube.com', 'github.com', 'stackoverflow.com',
            'reddit.com', 'twitter.com', 'facebook.com', 'instagram.com',
            'netflix.com', 'amazon.com', 'microsoft.com', 'apple.com'
        ];
        
        this.protocols = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'FTP'];
        this.states = ['ESTABLISHED', 'LISTEN', 'TIME_WAIT', 'CLOSE_WAIT'];
    }

    async start() {
        try {
            console.log('🔍 Starting network simulation...');
            
            this.isRunning = true;
            console.log('✅ Network simulation started');
            
            // Start periodic tasks
            this.startPeriodicTasks();
            
        } catch (error) {
            console.error('❌ Error starting network simulation:', error.message);
            throw error;
        }
    }

    startPeriodicTasks() {
        // Simulate packets every 2 seconds
        this.simulationInterval = setInterval(() => {
            this.simulatePackets();
        }, 2000);
        
        // Simulate connections every 5 seconds
        setInterval(() => {
            this.simulateConnections();
        }, 5000);
        
        // Simulate processes every 10 seconds
        setInterval(() => {
            this.simulateProcesses();
        }, 10000);
    }

    simulatePackets() {
        if (!this.isRunning) return;
        
        const packetCount = Math.floor(Math.random() * 5) + 1;
        
        for (let i = 0; i < packetCount; i++) {
            this.packetCount++;
            const protocol = this.protocols[Math.floor(Math.random() * this.protocols.length)];
            const sourceIP = `192.168.1.${Math.floor(Math.random() * 255)}`;
            const destIP = `10.0.0.${Math.floor(Math.random() * 255)}`;
            const sourcePort = Math.floor(Math.random() * 65535);
            const destPort = Math.floor(Math.random() * 65535);
            const size = Math.floor(Math.random() * 1500) + 64;
            const process = this.simulatedProcesses[Math.floor(Math.random() * this.simulatedProcesses.length)];
            const domain = this.simulatedDomains[Math.floor(Math.random() * this.simulatedDomains.length)];
            
            // Determine traffic direction
            const isOutgoing = sourcePort < destPort || 
                             (sourcePort >= 1024 && destPort < 1024);
            const direction = isOutgoing ? 'outgoing' : 'incoming';
            
            const packet = {
                id: Date.now() + this.packetCount,
                timestamp: new Date(),
                protocol: protocol,
                source: `${sourceIP}:${sourcePort}`,
                destination: `${destIP}:${destPort}`,
                size: size,
                details: `${protocol} ${sourcePort} → ${destPort}`,
                flags: protocol === 'TCP' ? this.getRandomFlags() : '',
                pid: process.pid,
                domain: Math.random() > 0.5 ? domain : null,
                direction: direction,
                rawData: {
                    protocol: protocol,
                    sourceIP: sourceIP,
                    sourcePort: sourcePort,
                    destIP: destIP,
                    destPort: destPort,
                    size: size,
                    pid: process.pid,
                    direction: direction,
                    domain: Math.random() > 0.5 ? domain : null,
                    timestamp: new Date().toISOString(),
                    flags: protocol === 'TCP' ? this.getRandomFlags() : '',
                    processName: process.name
                }
            };
            
            // If target process is set, only emit packets from that process
            if (this.targetProcess) {
                if (packet.pid === this.targetProcess) {
                    this.emit('packet', packet);
                }
            } else {
                // Global mode - emit all packets
                this.emit('packet', packet);
            }
        }
    }

    simulateConnections() {
        if (!this.isRunning) return;
        
        const connectionCount = Math.floor(Math.random() * 8) + 2;
        const connections = [];
        
        for (let i = 0; i < connectionCount; i++) {
            this.connectionCount++;
            const protocol = this.protocols[Math.floor(Math.random() * 2)]; // TCP or UDP
            const process = this.simulatedProcesses[Math.floor(Math.random() * this.simulatedProcesses.length)];
            const state = this.states[Math.floor(Math.random() * this.states.length)];
            
            const connection = {
                id: Date.now() + this.connectionCount,
                protocol: protocol,
                localAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
                localPort: Math.floor(Math.random() * 65535),
                remoteAddress: `10.0.0.${Math.floor(Math.random() * 255)}`,
                remotePort: Math.floor(Math.random() * 65535),
                state: state,
                pid: process.pid,
                timestamp: new Date()
            };
            
            connections.push(connection);
        }
        
        // If target process is set, filter connections for that process
        if (this.targetProcess) {
            const filteredConnections = connections.filter(conn => conn.pid === this.targetProcess);
            if (filteredConnections.length > 0) {
                this.emit('connections', filteredConnections);
            }
        } else {
            // Global mode - emit all connections
            this.emit('connections', connections);
        }
    }

    simulateProcesses() {
        if (!this.isRunning) return;
        
        this.processCount++;
        const processes = this.simulatedProcesses.map(proc => ({
            ...proc,
            cpu: proc.cpu + (Math.random() - 0.5) * 5, // Vary CPU usage
            memory: proc.memory + Math.floor(Math.random() * 100000), // Vary memory
            connections: Math.floor(Math.random() * 10) + 1,
            timestamp: new Date()
        }));
        
        // Filter processes based on target process if specified
        if (this.targetProcess) {
            const targetProcess = processes.find(p => p.pid === this.targetProcess);
            if (targetProcess) {
                this.emit('processes', [targetProcess]);
            } else {
                this.emit('processes', []);
            }
        } else {
            this.emit('processes', processes);
        }
    }

    getRandomFlags() {
        const flags = ['SYN', 'ACK', 'FIN', 'PSH', 'RST', 'URG'];
        const flagCount = Math.floor(Math.random() * 3) + 1;
        const selectedFlags = [];
        
        for (let i = 0; i < flagCount; i++) {
            const flag = flags[Math.floor(Math.random() * flags.length)];
            if (!selectedFlags.includes(flag)) {
                selectedFlags.push(flag);
            }
        }
        
        return selectedFlags.join(', ');
    }

    stop() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        
        this.isRunning = false;
        console.log('🛑 Network simulation stopped');
    }

    getStatistics() {
        return {
            isRunning: this.isRunning,
            packetCount: this.packetCount,
            connectionCount: this.connectionCount,
            processCount: this.processCount,
            simulatedProcesses: this.simulatedProcesses.length,
            simulatedDomains: this.simulatedDomains.length
        };
    }

    setTargetProcess(pid) {
        this.targetProcess = pid;
        console.log(`🎯 Target process set to PID: ${pid}`);
    }
}

module.exports = NetworkSimulator; 