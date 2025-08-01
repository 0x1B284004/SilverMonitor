const EventEmitter = require('events');
const pcap = require('pcap');
const dns = require('dns');
const psList = require('ps-list');

class NetworkMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.session = null;
        this.interfaces = [];
        this.dnsCache = new Map();
        this.processCache = new Map();
        this.connectionStats = new Map();
        this.targetProcess = null;
    }

    async start() {
        try {
            console.log('🔍 Starting real network monitoring...');
            
            // Get available interfaces
            this.interfaces = pcap.findalldevs();
            console.log(`📡 Found ${this.interfaces.length} network interfaces`);
            
            // Use the first available interface
            const networkInterface = this.interfaces[0];
            if (!networkInterface) {
                throw new Error('No network interfaces found');
            }
            
            console.log(`🎯 Using interface: ${networkInterface.name}`);
            
            // Create capture session
            this.session = pcap.createSession(networkInterface.name, 'ip');
            
            // Set up packet capture
            this.session.on('packet', (raw_packet) => {
                this.processPacket(raw_packet);
            });
            
            this.isRunning = true;
            console.log('✅ Real network monitoring started');
            
            // Start periodic tasks
            this.startPeriodicTasks();
            
        } catch (error) {
            console.error('❌ Error starting network monitoring:', error.message);
            throw error;
        }
    }

    async processPacket(raw_packet) {
        try {
            const packet = pcap.decode.packet(raw_packet);
            
            // Extract IP layer
            const ip = packet.link_type === 'ETHERNET' ? packet.payload.payload : packet.payload;
            if (!ip || ip.type !== 'IP') return;
            
            // Extract transport layer
            const transport = ip.payload;
            if (!transport) return;
            
            const packetInfo = {
                id: Date.now() + Math.random(),
                timestamp: new Date(),
                protocol: transport.type,
                source: `${ip.saddr}:${transport.sport}`,
                destination: `${ip.daddr}:${transport.dport}`,
                size: raw_packet.length,
                details: this.getPacketDetails(transport),
                flags: this.getTransportFlags(transport),
                pid: await this.getProcessForConnection(ip.saddr, transport.sport, ip.daddr, transport.dport)
            };
            
            // Resolve DNS for destination
            if (this.isPublicIP(ip.daddr)) {
                const domain = await this.resolveDNS(ip.daddr);
                if (domain) {
                    packetInfo.domain = domain;
                }
            }
            
            // Filter by target process if specified
            if (this.targetProcess) {
                if (packetInfo.pid === this.targetProcess) {
                    this.emit('packet', packetInfo);
                }
            } else {
                this.emit('packet', packetInfo);
            }
            
        } catch (error) {
            console.error('Error processing packet:', error);
        }
    }

    getPacketDetails(transport) {
        switch (transport.type) {
            case 'TCP':
                return `TCP ${transport.sport} → ${transport.dport}`;
            case 'UDP':
                return `UDP ${transport.sport} → ${transport.dport}`;
            case 'ICMP':
                return `ICMP ${transport.type} ${transport.code}`;
            default:
                return `${transport.type} packet`;
        }
    }

    getTransportFlags(transport) {
        if (transport.type === 'TCP') {
            const flags = [];
            if (transport.flags & 0x01) flags.push('FIN');
            if (transport.flags & 0x02) flags.push('SYN');
            if (transport.flags & 0x04) flags.push('RST');
            if (transport.flags & 0x08) flags.push('PSH');
            if (transport.flags & 0x10) flags.push('ACK');
            if (transport.flags & 0x20) flags.push('URG');
            return flags.join(', ');
        }
        return '';
    }

    async getProcessForConnection(localIP, localPort, remoteIP, remotePort) {
        try {
            const connections = await this.getNetworkConnections();
            
            for (const conn of connections) {
                if (conn.localAddress === localIP && 
                    conn.localPort === localPort &&
                    conn.remoteAddress === remoteIP && 
                    conn.remotePort === remotePort) {
                    return conn.pid;
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    async getNetworkConnections() {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execAsync = util.promisify(exec);
            
            // Use netstat to get active connections
            const { stdout } = await execAsync('netstat -ano');
            
            const connections = [];
            const lines = stdout.split('\n');
            
            for (const line of lines) {
                if (line.includes('TCP') || line.includes('UDP')) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        const [protocol, localAddress, remoteAddress, state, pid] = parts;
                        
                        if (pid && pid !== 'PID') {
                            const [localIP, localPort] = localAddress.split(':');
                            const [remoteIP, remotePort] = remoteAddress.split(':');
                            
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
                this.dnsCache.set(ip, hostnames[0]);
                return hostnames[0];
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
            
            for (const proc of processes) {
                const connections = await this.getProcessConnections(proc.pid);
                processesWithConnections.push({
                    pid: proc.pid,
                    name: proc.name,
                    cpu: proc.cpu,
                    memory: proc.memory,
                    connections: connections,
                    timestamp: new Date()
                });
            }
            
            return processesWithConnections;
        } catch (error) {
            console.error('Error getting processes:', error);
            return [];
        }
    }

    async getProcessConnections(pid) {
        try {
            const connections = await this.getNetworkConnections();
            return connections.filter(conn => conn.pid === pid).length;
        } catch (error) {
            return 0;
        }
    }

    startPeriodicTasks() {
        // Update connections every 5 seconds
        setInterval(async () => {
            try {
                const connections = await this.getNetworkConnections();
                
                // Filter by target process if specified
                if (this.targetProcess) {
                    const filteredConnections = connections.filter(conn => conn.pid === this.targetProcess);
                    if (filteredConnections.length > 0) {
                        this.emit('connections', filteredConnections);
                    }
                } else {
                    this.emit('connections', connections);
                }
            } catch (error) {
                console.error('Error updating connections:', error);
            }
        }, 5000);
        
        // Update processes every 10 seconds
        setInterval(async () => {
            try {
                const processes = await this.getActiveProcesses();
                this.emit('processes', processes);
            } catch (error) {
                console.error('Error updating processes:', error);
            }
        }, 10000);
    }

    setTargetProcess(pid) {
        this.targetProcess = pid;
        console.log(`🎯 Target process set to PID: ${pid}`);
    }

    stop() {
        if (this.session) {
            this.session.close();
            this.session = null;
        }
        
        this.isRunning = false;
        console.log('🛑 Real network monitoring stopped');
    }

    getStatistics() {
        return {
            isRunning: this.isRunning,
            interfaces: this.interfaces.length,
            dnsCacheSize: this.dnsCache.size,
            processCacheSize: this.processCache.size
        };
    }
}

module.exports = NetworkMonitor; 