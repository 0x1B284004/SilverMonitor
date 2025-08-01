const EventEmitter = require('events');

class Database extends EventEmitter {
    constructor() {
        super();
        this.packets = [];
        this.connections = [];
        this.processes = [];
        this.domains = new Map();
        this.statistics = {
            totalPackets: 0,
            totalConnections: 0,
            activeProcesses: 0,
            uniqueDomains: 0,
            protocols: {},
            ports: {}
        };
        this.maxItems = 10000; // Limit to prevent memory overload
    }

    async init() {
        console.log('📊 In-memory database initialized');
        return Promise.resolve();
    }

    async savePacket(packet) {
        this.packets.unshift(packet);
        
        // Keep only the latest packets
        if (this.packets.length > this.maxItems) {
            this.packets = this.packets.slice(0, this.maxItems);
        }
        
        // Update statistics
        this.statistics.totalPackets++;
        this.statistics.protocols[packet.protocol] = (this.statistics.protocols[packet.protocol] || 0) + 1;
        
        this.emit('packet', packet);
    }

    async saveConnection(connection) {
        this.connections.unshift(connection);
        
        // Keep only the latest connections
        if (this.connections.length > this.maxItems) {
            this.connections = this.connections.slice(0, this.maxItems);
        }
        
        // Update statistics
        this.statistics.totalConnections++;
        this.statistics.ports[connection.remotePort] = (this.statistics.ports[connection.remotePort] || 0) + 1;
        
        this.emit('connection', connection);
    }

    async saveProcess(process) {
        const existingIndex = this.processes.findIndex(p => p.pid === process.pid);
        if (existingIndex >= 0) {
            this.processes[existingIndex] = process;
        } else {
            this.processes.unshift(process);
        }
        
        // Keep only the latest processes
        if (this.processes.length > this.maxItems) {
            this.processes = this.processes.slice(0, this.maxItems);
        }
        
        // Update statistics
        this.statistics.activeProcesses = this.processes.length;
        
        this.emit('process', process);
    }

    async updateDomainStats(domain, count = 1) {
        const current = this.domains.get(domain) || 0;
        this.domains.set(domain, current + count);
        this.statistics.uniqueDomains = this.domains.size;
        
        this.emit('domain', { domain, count: current + count });
    }

    async getPackets(limit = 50, offset = 0) {
        return this.packets.slice(offset, offset + limit);
    }

    async getConnections(limit = 50, offset = 0) {
        return this.connections.slice(offset, offset + limit);
    }

    async getProcesses() {
        return this.processes;
    }

    async getTopDomains(limit = 10) {
        return Array.from(this.domains.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([domain, count]) => ({ domain, count }));
    }

    async getProtocolStats() {
        return Object.entries(this.statistics.protocols)
            .map(([protocol, count]) => ({ protocol, count }))
            .sort((a, b) => b.count - a.count);
    }

    async getPortStats() {
        return Object.entries(this.statistics.ports)
            .map(([port, count]) => ({ port: parseInt(port), count }))
            .sort((a, b) => b.count - a.count);
    }

    async getProcessStats(pid) {
        return this.processes.find(p => p.pid === pid);
    }

    async getRecentActivity(minutes = 5) {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return {
            packets: this.packets.filter(p => p.timestamp > cutoff),
            connections: this.connections.filter(c => c.timestamp > cutoff),
            processes: this.processes.filter(p => p.timestamp > cutoff)
        };
    }

    async getGeneralStats() {
        return {
            totalPackets: this.statistics.totalPackets,
            totalConnections: this.statistics.totalConnections,
            activeProcesses: this.statistics.activeProcesses,
            uniqueDomains: this.statistics.uniqueDomains,
            protocols: Object.keys(this.statistics.protocols).length,
            ports: Object.keys(this.statistics.ports).length
        };
    }

    async saveStatistics() {
        // In-memory storage doesn't need persistent saving
        return Promise.resolve();
    }

    clear() {
        this.packets = [];
        this.connections = [];
        this.processes = [];
        this.domains.clear();
        this.statistics = {
            totalPackets: 0,
            totalConnections: 0,
            activeProcesses: 0,
            uniqueDomains: 0,
            protocols: {},
            ports: {}
        };
    }

    clearData() {
        this.clear();
    }

    async close() {
        console.log('📊 In-memory database closed');
        return Promise.resolve();
    }

    // Compatibility methods for SQLite-like interface
    async run(sql, params = []) {
        console.warn('⚠️ run() method called - using in-memory storage');
        return Promise.resolve();
    }

    async get(sql, params = []) {
        console.warn('⚠️ get() method called - using in-memory storage');
        return Promise.resolve(null);
    }

    async all(sql, params = []) {
        console.warn('⚠️ all() method called - using in-memory storage');
        return Promise.resolve([]);
    }
}

module.exports = Database; 