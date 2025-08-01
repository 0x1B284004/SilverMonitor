# SilverMonitor 🔍

**Complete network monitoring tool to analyze process traffic**

SilverMonitor is an advanced network monitoring tool that captures, analyzes, and visualizes in real-time all network traffic from a system or specific process. It automatically classifies data according to protocols, ports, domains, IPs, packets, requests, and messages.

## ✨ Features

### 🔍 Complete Monitoring
- **🖥️ Global PC Traffic Monitoring** - Capture ALL network traffic on your PC
- **🎯 Single Process Monitoring** - Monitor traffic from a specific process
- **Process monitoring** - Monitor a specific process by PID
- **Web interface** - Modern dashboard with real-time visualizations

### 📊 Advanced Analysis
- **Automatic classification** of protocols (TCP, UDP, HTTP, HTTPS, DNS, etc.)
- **Application identification** by port and behavior
- **DNS resolution** of IP addresses
- **TCP flags analysis** and ICMP types
- **Active domain detection**

### 🗄️ Storage and History
- **In-memory database** for optimal performance
- **Complete history** of packets and connections (memory limited)
- **Detailed statistics** by protocol, port, and domain
- **Real-time data** without database latency

### 🌐 Web Interface
- **Real-time dashboard** with WebSockets
- **Interactive charts** (Chart.js)
- **Packet visualization** in streaming
- **Active process monitoring**
- **Responsive and modern interface**

## 🚀 Installation

### Prerequisites
- Node.js 16+ 
- Windows 10/11 (for real network monitoring)
- Administrator rights (for network capture)

### Installation
```bash
# Clone the project
git clone https://github.com/your-repo/SilverMonitor.git
cd SilverMonitor

# Install dependencies
npm install
```

## 📖 Usage

### Default Behavior (Dashboard Web)
```bash
# Start dashboard web interface (default)
npm start

# Or directly
node src/index.js
```

### CLI Mode (Optional)
```bash
# Start in CLI mode with interactive menu
npm start -- --cli
# or
npm start -- -c
```

### CLI Commands
```bash
# Start dashboard web interface (default)
npm start
# or
npm run dashboard

# Start in CLI mode (interactive menu)
npm run cli
# or
npm start -- --cli
# or
npm start -- -c

# Web interface only
npm run web

# Using batch scripts (Windows)
start.bat          # Dashboard web interface with port cleanup
start-web.bat      # Direct web interface with port cleanup
```

### Animated Web Interface
```bash
# Start web server
npm run web

# Access interface
# http://localhost:3000
```

**Visual features:**
- **Dark and light themes** with animated transition (Ctrl+T)
- **CSS animations** for modern experience
- **Hover effects** and smooth transitions
- **Visual indicators** for real-time elements
- **Interactive charts** with transitions
- **Keyboard shortcuts** for quick navigation

## 🔧 Real Network Monitoring

SilverMonitor now uses **real network monitoring** on Windows:
- **Real connection detection** using `netstat`
- **Process association** with network connections
- **DNS resolution** for external IPs
- **Live traffic analysis** without simulation
- **Automatic fallback** to simulator if needed

## 🎯 Monitoring Modes

### 1. 🖥️ Global PC Traffic Monitoring
Capture and analyze ALL network traffic on your PC:
```bash
# Interactive mode
npm start
# Select "Global PC Traffic Monitoring"

# Direct command
npm run global
```

### 2. 🎯 Single Process Monitoring
Monitor traffic from a specific process:
```bash
# Interactive mode
npm start
# Select "Single Process Monitoring"

# Direct command
npm run process
```

### 3. Web Interface
Complete dashboard with visualizations:
```bash
npm run web
# Access http://localhost:3000
```



## 📊 Captured Data

### Network Packets
- **Source/destination addresses** (IP + port)
- **Protocols** (TCP, UDP, HTTP, HTTPS, DNS, etc.)
- **Packet sizes** and TCP flags
- **Applications** identified by port
- **Specific details** according to protocol

### Connections
- **Connection states** (ESTABLISHED, LISTEN, etc.)
- **Associated processes** (PID)
- **Connection duration**
- **Bidirectional traffic**

### Processes
- **System information** (CPU, memory, etc.)
- **Active connections** per process
- **Network activity history**

### Domains
- **Automatic DNS resolution**
- **Activity statistics**
- **Visit history**

## 🔧 Configuration

### Environment Variables
```bash
# Web server port (default: 3000)
PORT=3000

# Network interface (default: first interface)
NETWORK_INTERFACE=eth0

# Log level (default: info)
LOG_LEVEL=info
```

### Configuration File
Create `config.json`:
```json
{
  "web": {
    "port": 3000,
    "host": "localhost"
  },
  "monitoring": {
    "interface": "auto",
    "maxPackets": 10000,
    "dnsCache": true
  },
  "memory": {
    "maxPackets": 10000,
    "maxConnections": 10000,
    "maxProcesses": 1000
  }
}
```

## 📈 REST API

### Main Endpoints
```bash
# General statistics
GET /api/stats

# Recent packets
GET /api/packets?limit=50&offset=0

# Active connections
GET /api/connections?limit=50&offset=0

# Active processes
GET /api/processes

# Statistics by protocol
GET /api/protocols

# Most used ports
GET /api/ports

# Most active domains
GET /api/domains?limit=10

# Recent activity
GET /api/activity?minutes=5

# Process statistics
GET /api/process/:pid

# Start monitoring a process
POST /api/monitor/process/:pid

# Stop monitoring
POST /api/monitor/stop
```

## 🔌 WebSockets

### Real-time Events
```javascript
// Connection
const socket = io('http://localhost:3000');

// Listen for new packets
socket.on('packet', (packet) => {
    console.log('New packet:', packet);
});

// Listen for new connections
socket.on('connection', (connection) => {
    console.log('New connection:', connection);
});

// Listen for process updates
socket.on('processes', (processes) => {
    console.log('Processes updated:', processes);
});

// Listen for statistics
socket.on('stats', (stats) => {
    console.log('Statistics updated:', stats);
});
```

## 🛠️ Architecture

### Project Structure
```
SilverMonitor/
├── src/
│   ├── index.js              # Main entry point
│   ├── network-simulator.js  # Network simulation
│   ├── database.js          # In-memory database
│   ├── web-server.js        # Express web server
│   └── public/              # Web interface
│       ├── index.html       # Main dashboard
│       └── app.js          # Client JavaScript

├── logs/                    # Log files
├── package.json
└── README.md
```

### Technologies Used
- **Node.js** - JavaScript runtime
- **Express** - Web server
- **Socket.io** - Real-time WebSockets
- **In-memory storage** - Optimal performance
- **Network simulator** - Real-time demonstration
- **Chart.js** - Interactive charts
- **Bootstrap** - User interface

## 🔒 Security

### Required Permissions
- **Administrator rights** for packet capture
- **Network access** for monitoring
- **Process read permissions** for system processes

### Best Practices
- Use only on trusted systems
- Do not capture sensitive traffic in production
- Limit web interface access
- Monitor resource usage

## 🐛 Troubleshooting

### Common Issues

**Simulation error:**
```bash
# Restart application
npm start
```

**Network interface not found:**
```bash
# List available interfaces
node -e "console.log(require('pcap').findalldevs())"
```

**Memory issue:**
```bash
# Restart application
npm start
```

### Logs
Logs are available in:
- `logs/combined.log` - General logs
- `logs/error.log` - Errors only

## 🤝 Contribution

### Development
```bash
# Install development dependencies
npm install

# Development mode with auto-reload
npm run dev

# Tests
npm test
```

### Code Structure
- **ES6+** for modern syntax
- **Classes** for code organization
- **Promises/async-await** for asynchronous operations
- **Events** for module communication

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Express** for the web server
- **Chart.js** for visualizations
- **Bootstrap** for user interface

---

**SilverMonitor** - Intelligent and complete network monitoring 🔍