#!/usr/bin/env node


const inquirer = require('inquirer');
const chalk = require('chalk');
const { WebServer } = require('./web-server');
const Database = require('./database');
const psList = require('ps-list');

// Try to load Windows network monitor, fallback to simulator
let NetworkMonitor;
try {
    NetworkMonitor = require('./network-monitor-windows');
    console.log('✅ Windows network monitoring available');
} catch (error) {
    console.log('⚠️ Windows network monitoring not available, using simulator');
    NetworkMonitor = require('./network-simulator');
}

class SilverMonitor {
    constructor() {
        this.database = new Database();
        this.networkMonitor = new NetworkMonitor();
        this.webServer = null;
    }

    async start() {
        // Check if CLI mode is requested
        const args = process.argv.slice(2);
        const isCLIMode = args.includes('--cli') || args.includes('-c');
        
        if (isCLIMode) {
            await this.startCLI();
        } else {
            // Default: Start web interface directly
            await this.startWebInterface();
        }
    }

    async startCLI() {
        console.log(chalk.blue.bold('\n🔍 SilverMonitor - Real Network Monitoring (CLI Mode)\n'));
        
        const choices = [
            { name: '🖥️ Global PC Traffic Monitoring', value: 'global' },
            { name: '🎯 Single Process Monitoring', value: 'process' },
            { name: '🌐 Web Interface (Dashboard)', value: 'web' },
            { name: '❌ Exit', value: 'exit' }
        ];

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: choices
            }
        ]);

        switch (action) {
            case 'web':
                await this.startWebInterface();
                break;
            case 'global':
                await this.startGlobalMonitoring();
                break;
            case 'process':
                await this.startProcessMonitoring();
                break;
            case 'exit':
                console.log(chalk.yellow('👋 Goodbye!'));
                process.exit(0);
                break;
        }
    }

    async startWebInterface() {
        console.log(chalk.green('\n🚀 Starting SilverMonitor Dashboard...'));
        console.log(chalk.cyan('📡 Initializing real network monitoring...'));
        
        try {
            await this.database.init();
            this.webServer = new WebServer();
            await this.webServer.start(3000);
            
            console.log(chalk.green('\n✅ SilverMonitor Dashboard is ready!'));
            console.log(chalk.cyan('\n🌐 Open your browser and go to:'));
            console.log(chalk.cyan('   http://localhost:3000'));
            console.log(chalk.yellow('\n💡 Choose your monitoring mode in the dashboard'));
            console.log(chalk.yellow('⏹️  Press Ctrl+C to stop'));
            
        } catch (error) {
            console.error(chalk.red('❌ Error starting web interface:'), error);
        }
    }

    async startGlobalMonitoring() {
        console.log(chalk.green('\n✅ Starting GLOBAL PC traffic monitoring...'));
        console.log(chalk.cyan('📡 This will capture ALL network traffic on your PC'));
        
        try {
            await this.database.init();
            
            // Configure real network monitor events for global monitoring
            this.networkMonitor.on('packet', async (packet) => {
                await this.database.savePacket(packet);
                console.log(chalk.cyan(`📦 [${packet.protocol}] ${packet.source} → ${packet.destination} (${packet.size} bytes)`));
                if (packet.domain) {
                    console.log(chalk.gray(`   Domain: ${packet.domain}`));
                }
                if (packet.flags) {
                    console.log(chalk.gray(`   Flags: ${packet.flags}`));
                }
                if (packet.pid) {
                    console.log(chalk.gray(`   Process PID: ${packet.pid}`));
                }
            });
            
            this.networkMonitor.on('connections', async (connections) => {
                for (const connection of connections) {
                    await this.database.saveConnection(connection);
                    console.log(chalk.green(`🔗 [${connection.state}] ${connection.localAddress}:${connection.localPort} → ${connection.remoteAddress}:${connection.remotePort} (PID: ${connection.pid})`));
                }
            });
            
            this.networkMonitor.on('processes', async (processes) => {
                for (const process of processes) {
                    await this.database.saveProcess(process);
                }
                console.log(chalk.yellow(`⚙️ ${processes.length} active processes with network activity`));
            });
            
            // Start real network monitoring for ALL traffic
            await this.networkMonitor.start();
            
            console.log(chalk.cyan('\n📊 GLOBAL PC traffic monitoring in progress...'));
            console.log(chalk.yellow('⏹️  Press Ctrl+C to stop'));
            console.log(chalk.gray('💡 All network packets will be captured and displayed'));
            
        } catch (error) {
            console.error(chalk.red('❌ Error starting global monitoring:'), error);
            console.log(chalk.yellow('💡 Make sure you have administrator privileges'));
        }
    }

    async startProcessMonitoring() {
        console.log(chalk.green('\n✅ Starting SINGLE PROCESS monitoring...'));
        
        try {
            // Get all running processes
            console.log(chalk.cyan('📋 Loading running processes...'));
            const processes = await psList();
            
            // Filter processes with network activity (optional)
            const networkProcesses = processes.filter(p => 
                p.name && !p.name.includes('System') && 
                !p.name.includes('svchost') && 
                !p.name.includes('RuntimeBroker')
            ).slice(0, 50); // Limit to 50 for display
            
            const processChoices = networkProcesses.map(proc => ({
                name: `${proc.name} (PID: ${proc.pid}) - ${proc.cpu ? proc.cpu.toFixed(1) : '0'}% CPU`,
                value: proc
            }));
            
            const { selectedProcess } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'selectedProcess',
                    message: 'Select a process to monitor:',
                    choices: processChoices
                }
            ]);
            
            console.log(chalk.green(`\n🎯 Monitoring process: ${selectedProcess.name} (PID: ${selectedProcess.pid})`));
            
            await this.database.init();
            
            // Configure network monitor for specific process
            this.networkMonitor.on('packet', async (packet) => {
                // Only show packets from the selected process
                if (packet.pid === selectedProcess.pid) {
                    await this.database.savePacket(packet);
                    console.log(chalk.cyan(`📦 [${packet.protocol}] ${packet.source} → ${packet.destination} (${packet.size} bytes)`));
                    if (packet.domain) {
                        console.log(chalk.gray(`   Domain: ${packet.domain}`));
                    }
                    if (packet.flags) {
                        console.log(chalk.gray(`   Flags: ${packet.flags}`));
                    }
                }
            });
            
            this.networkMonitor.on('connections', async (connections) => {
                // Filter connections for the selected process
                const processConnections = connections.filter(conn => conn.pid === selectedProcess.pid);
                
                for (const connection of processConnections) {
                    await this.database.saveConnection(connection);
                    console.log(chalk.green(`🔗 [${connection.state}] ${connection.localAddress}:${connection.localPort} → ${connection.remoteAddress}:${connection.remotePort}`));
                }
            });
            
            this.networkMonitor.on('processes', async (processes) => {
                // Only show the selected process
                const targetProcess = processes.find(p => p.pid === selectedProcess.pid);
                if (targetProcess) {
                    await this.database.saveProcess(targetProcess);
                    console.log(chalk.yellow(`⚙️ Process: ${targetProcess.name} - CPU: ${targetProcess.cpu?.toFixed(1) || '0'}% - Memory: ${targetProcess.memory ? Math.round(targetProcess.memory / 1024 / 1024) : 0}MB`));
                }
            });
            
            // Start monitoring for the specific process
            await this.networkMonitor.start();
            
            console.log(chalk.cyan(`\n📊 Monitoring traffic for: ${selectedProcess.name} (PID: ${selectedProcess.pid})`));
            console.log(chalk.yellow('⏹️  Press Ctrl+C to stop'));
            console.log(chalk.gray('💡 Only packets from this process will be displayed'));
            
        } catch (error) {
            console.error(chalk.red('❌ Error starting process monitoring:'), error);
            console.log(chalk.yellow('💡 Make sure you have administrator privileges'));
        }
    }



    async stop() {
        if (this.networkMonitor) {
            this.networkMonitor.stop();
        }
        if (this.webServer) {
            await this.webServer.stop();
        }
        if (this.database) {
            await this.database.close();
        }
    }
}

// Handle shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 Shutting down...'));
    process.exit(0);
});

// Start in interactive mode
const monitor = new SilverMonitor();
monitor.start(); 