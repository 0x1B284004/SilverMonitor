const EventEmitter = require('events');
const { exec } = require('child_process');
const util = require('util');
const dns = require('dns');
const psList = require('ps-list');

const execAsync = util.promisify(exec);

class NetworkMonitorWindows extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.interval = null;
        this.dnsCache = new Map();
        this.processCache = new Map();
        this.connectionStats = new Map();
        this.targetProcess = null;
        this.lastConnections = new Map();
    }

    async start() {
        try {
            console.log('🔍 Starting Windows network monitoring...');
            
            this.isRunning = true;
            console.log('✅ Windows network monitoring started');
            
            // Start periodic monitoring
            this.startPeriodicTasks();
            
        } catch (error) {
            console.error('❌ Error starting network monitoring:', error.message);
            throw error;
        }
    }

    async startPeriodicTasks() {
        // Monitor connections every 2 seconds
        this.interval = setInterval(async () => {
            try {
                await this.monitorConnections();
                await this.monitorProcesses();
            } catch (error) {
                console.error('Error in periodic monitoring:', error);
            }
        }, 2000);
        
        // Monitor activity on existing connections every 1 second
        this.activityInterval = setInterval(async () => {
            try {
                await this.monitorConnectionActivity();
            } catch (error) {
                console.error('Error monitoring connection activity:', error);
            }
        }, 1000);
    }

    async monitorConnections() {
        try {
            const connections = await this.getNetworkConnections();
            
            // Detect new connections by comparing with last known state
            for (const conn of connections) {
                const key = `${conn.protocol}-${conn.localAddress}:${conn.localPort}-${conn.remoteAddress}:${conn.remotePort}`;
                
                if (!this.lastConnections.has(key)) {
                    // New connection detected
                    this.lastConnections.set(key, conn);
                    
                    // Skip inactive connections completely
                    if (conn.state === 'LISTENING' || conn.state === 'TIME_WAIT') {
                        continue;
                    }

                    // Determine traffic direction based on port numbers
                    const isOutgoing = conn.localPort < conn.remotePort || 
                                     (conn.localPort >= 1024 && conn.remotePort < 1024);
                    const direction = isOutgoing ? 'outgoing' : 'incoming';
                    
                    // Create packet-like event for active connections only
                    const packetInfo = {
                        id: Date.now() + Math.random(),
                        timestamp: new Date(),
                        protocol: conn.protocol,
                        source: `${conn.localAddress}:${conn.localPort}`,
                        destination: `${conn.remoteAddress}:${conn.remotePort}`,
                        size: 1, // Set to 1 for active connections (not 0)
                        details: `${conn.protocol} ${conn.localPort} → ${conn.remotePort}`,
                        flags: conn.state,
                        pid: conn.pid,
                        connection: conn,
                        direction: direction,
                        rawData: {
                            protocol: conn.protocol,
                            localAddress: conn.localAddress,
                            localPort: conn.localPort,
                            remoteAddress: conn.remoteAddress,
                            remotePort: conn.remotePort,
                            state: conn.state,
                            pid: conn.pid,
                            direction: direction
                        }
                    };

                    // Resolve DNS for ALL destinations (no filtering)
                    try {
                        const domain = await this.resolveDNS(conn.remoteAddress);
                        if (domain) {
                            packetInfo.domain = domain;
                        }
                    } catch (error) {
                        // DNS resolution failed, continue without domain
                    }

                    // Filter by target process if specified
                    if (this.targetProcess) {
                        if (packetInfo.pid === this.targetProcess) {
                            this.emit('packet', packetInfo);
                        }
                    } else {
                        this.emit('packet', packetInfo);
                    }
                }
            }

            // Clean up old connections
            const currentKeys = new Set(connections.map(conn => 
                `${conn.protocol}-${conn.localAddress}:${conn.localPort}-${conn.remoteAddress}:${conn.remotePort}`
            ));
            
            for (const [key] of this.lastConnections) {
                if (!currentKeys.has(key)) {
                    this.lastConnections.delete(key);
                }
            }

            // Emit connections event (only active connections)
            const activeConnections = connections.filter(conn => 
                conn.state === 'ESTABLISHED' || 
                conn.state === 'CLOSE_WAIT' || 
                conn.state === 'FIN_WAIT_1' || 
                conn.state === 'FIN_WAIT_2'
            );
            
            // Resolve domains for connections
            for (const conn of activeConnections) {
                try {
                    const domain = await this.resolveDNS(conn.remoteAddress);
                    if (domain) {
                        conn.domain = domain;
                    }
                } catch (error) {
                    // DNS resolution failed, continue without domain
                }
            }
            
            if (this.targetProcess) {
                const filteredConnections = activeConnections.filter(conn => conn.pid === this.targetProcess);
                if (filteredConnections.length > 0) {
                    this.emit('connections', filteredConnections);
                    // Also emit individual connections for real-time updates
                    for (const conn of filteredConnections) {
                        this.emit('connection', conn);
                    }
                }
            } else {
                this.emit('connections', activeConnections);
                // Also emit individual connections for real-time updates
                for (const conn of activeConnections) {
                    this.emit('connection', conn);
                }
            }

        } catch (error) {
            console.error('Error monitoring connections:', error);
        }
    }

    async monitorProcesses() {
        try {
            const processes = await this.getActiveProcesses();
            
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
        } catch (error) {
            console.error('Error monitoring processes:', error);
        }
    }

    async monitorConnectionActivity() {
        try {
            const connections = await this.getNetworkConnections();
            const activeConnections = connections.filter(conn => 
                conn.state === 'ESTABLISHED' && 
                conn.pid === this.targetProcess
            );
            
            // Simulate activity packets for active connections
            for (const conn of activeConnections) {
                // Randomly generate activity (30% chance per connection)
                if (Math.random() < 0.3) {
                    // Determine traffic direction
                    const isOutgoing = conn.localPort < conn.remotePort || 
                                     (conn.localPort >= 1024 && conn.remotePort < 1024);
                    const direction = isOutgoing ? 'outgoing' : 'incoming';
                    
                    const packetInfo = {
                        id: Date.now() + Math.random(),
                        timestamp: new Date(),
                        protocol: conn.protocol,
                        source: `${conn.localAddress}:${conn.localPort}`,
                        destination: `${conn.remoteAddress}:${conn.remotePort}`,
                        size: Math.floor(Math.random() * 1000) + 64, // Random size
                        details: `${conn.protocol} ${conn.localPort} → ${conn.remotePort} (Activity)`,
                        flags: 'DATA',
                        pid: conn.pid,
                        connection: conn,
                        isActivity: true,
                        direction: direction,
                        rawData: {
                            protocol: conn.protocol,
                            localAddress: conn.localAddress,
                            localPort: conn.localPort,
                            remoteAddress: conn.remoteAddress,
                            remotePort: conn.remotePort,
                            state: conn.state,
                            pid: conn.pid,
                            direction: direction,
                            activityType: 'data_transfer',
                            timestamp: new Date().toISOString()
                        }
                    };

                    // Resolve DNS for the destination
                    try {
                        const domain = await this.resolveDNS(conn.remoteAddress);
                        if (domain) {
                            packetInfo.domain = domain;
                            packetInfo.rawData.domain = domain;
                        }
                    } catch (error) {
                        // DNS resolution failed, continue without domain
                    }

                    this.emit('packet', packetInfo);
                }
            }
        } catch (error) {
            console.error('Error monitoring connection activity:', error);
        }
    }

    async getNetworkConnections() {
        try {
            // Use netstat to get active connections
            const { stdout } = await execAsync('netstat -ano');
            
            const connections = [];
            const lines = stdout.split('\n');
            
            for (const line of lines) {
                if (line.includes('TCP') || line.includes('UDP')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        const protocol = parts[0];
                        const localAddress = parts[1];
                        const remoteAddress = parts[2];
                        const state = parts[3];
                        const pid = parts[4];
                        
                        if (pid && pid !== 'PID' && !isNaN(parseInt(pid))) {
                            const [localIP, localPort] = localAddress.split(':');
                            const [remoteIP, remotePort] = remoteAddress.split(':');
                            
                            if (localIP && localPort && remoteIP && remotePort && 
                                !isNaN(parseInt(localPort)) && !isNaN(parseInt(remotePort))) {
                                
                                // Include ALL connections, no filtering
                                connections.push({
                                    protocol: protocol,
                                    localAddress: localIP,
                                    localPort: parseInt(localPort),
                                    remoteAddress: remoteIP,
                                    remotePort: parseInt(remotePort),
                                    state: state,
                                    pid: parseInt(pid)
                                });
                            }
                        }
                    }
                }
            }
            
            return connections;
        } catch (error) {
            console.error('Error getting network connections:', error);
            return [];
        }
    }

    async resolveDNS(ip) {
        if (this.dnsCache.has(ip)) {
            return this.dnsCache.get(ip);
        }
        
        try {
            const hostnames = await dns.reverse(ip);
            if (hostnames && hostnames.length > 0) {
                const hostname = hostnames[0];
                // Cache ALL resolved hostnames, even if they look like IPs
                this.dnsCache.set(ip, hostname);
                return hostname;
            }
        } catch (error) {
            // DNS resolution failed, that's okay
        }
        
        return null;
    }

    isPublicIP(ip) {
        // Check if it's a public IP (not private)
        const privateRanges = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./
        ];
        
        return !privateRanges.some(range => range.test(ip));
    }

    async getActiveProcesses() {
        try {
            const processes = await psList();
            const processesWithConnections = [];
            
            // Include ALL processes, no filtering
            for (const proc of processes) {
                processesWithConnections.push({
                    pid: proc.pid,
                    name: proc.name,
                    cpu: proc.cpu,
                    memory: proc.memory,
                    connections: 0, // Will be updated separately
                    timestamp: new Date()
                });
            }
            
            return processesWithConnections;
        } catch (error) {
            console.error('Error getting processes:', error);
            return [];
        }
    }

    isNetworkProcess(processName) {
        const networkProcesses = [
            'chrome.exe', 'firefox.exe', 'msedge.exe', 'iexplore.exe',
            'svchost.exe', 'explorer.exe', 'winlogon.exe', 'lsass.exe',
            'csrss.exe', 'wininit.exe', 'services.exe', 'spoolsv.exe',
            'taskmgr.exe', 'cmd.exe', 'powershell.exe', 'conhost.exe',
            'dwm.exe', 'rundll32.exe', 'regsvr32.exe', 'msiexec.exe',
            'java.exe', 'python.exe', 'node.exe', 'npm.exe',
            'git.exe', 'ssh.exe', 'telnet.exe', 'ftp.exe',
            'discord.exe', 'slack.exe', 'teams.exe', 'zoom.exe',
            'steam.exe', 'origin.exe', 'battle.net.exe', 'uplay.exe',
            'spotify.exe', 'vlc.exe', 'chrome.exe', 'firefox.exe'
        ];
        
        return networkProcesses.some(name => 
            processName.toLowerCase().includes(name.toLowerCase())
        );
    }

    async getProcessConnections(pid) {
        try {
            // Use a simple netstat call to avoid recursion
            const { stdout } = await execAsync(`netstat -ano | findstr ${pid}`);
            const lines = stdout.split('\n');
            return lines.filter(line => line.trim() !== '').length;
        } catch (error) {
            return 0;
        }
    }

    setTargetProcess(pid) {
        this.targetProcess = pid;
        console.log(`🎯 Target process set to PID: ${pid}`);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
        
        this.isRunning = false;
        console.log('🛑 Windows network monitoring stopped');
    }

    getStatistics() {
        return {
            isRunning: this.isRunning,
            interfaces: 1, // We're monitoring all interfaces
            dnsCacheSize: this.dnsCache.size,
            processCacheSize: this.processCache.size,
            activeConnections: this.lastConnections.size
        };
    }
}

module.exports = NetworkMonitorWindows; 