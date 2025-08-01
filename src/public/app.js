// Configuration des couleurs pour les graphiques
Chart.defaults.color = '#ecf0f1';
Chart.defaults.borderColor = '#444';

let socket;
let protocolChart;
let portChart;
let currentTheme = 'dark';
let currentMode = 'global';
let selectedProcess = null;
let currentProcessData = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    // Don't start socket connection until mode is selected
    setupWelcomeScreen();
    setupThemeToggle();
});

function initializeTheme() {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('silvermonitor-theme') || 'dark';
    setTheme(savedTheme);
}

function setupWelcomeScreen() {
    // Welcome screen is shown by default
    // No additional setup needed
}

function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
            showNotification(`Theme switched to ${newTheme} mode`, 'info');
        });
    }
}

// Global functions for mode selection
function selectMode(mode) {
    currentMode = mode;
    
    // Hide welcome screen and show dashboard
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('mainDashboard').style.display = 'block';
    
    // Initialize dashboard based on mode
    initializeDashboard(mode);
}

function showWelcomeScreen() {
    document.getElementById('mainDashboard').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'block';
}

function initializeDashboard(mode) {
    // Initialize socket connection
    initializeSocket();
    initializeCharts();
    
    if (mode === 'global') {
        startGlobalMonitoring();
        updateModeIndicator('global');
    } else if (mode === 'process') {
        showProcessSelection();
        updateModeIndicator('process');
    }
}

function showProcessSelection() {
    const processSelection = document.getElementById('processSelection');
    if (processSelection) {
        processSelection.style.display = 'block';
        setupProcessSelection();
        
        // Reset process selection state
        selectedProcess = null;
        const processPID = document.getElementById('processPID');
        const processInfo = document.getElementById('processInfo');
        
        if (processPID) {
            processPID.value = '';
            processPID.focus();
        }
        if (processInfo) {
            processInfo.style.display = 'none';
        }
        
        // Hide change process button during selection
        const changeProcessBtn = document.getElementById('changeProcessBtn');
        if (changeProcessBtn) {
            changeProcessBtn.style.display = 'none';
        }
        
        // Update mode indicator to show selection needed
        updateModeIndicator('process');
    }
}

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('silvermonitor-theme', theme);
    
    // Update theme icon if it exists
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        let themeIcon = themeToggle.querySelector('i');
        if (!themeIcon) {
            // Create icon if it doesn't exist
            themeIcon = document.createElement('i');
            themeToggle.appendChild(themeIcon);
        }
        
        if (theme === 'dark') {
            themeIcon.className = 'fas fa-moon';
            Chart.defaults.color = '#ecf0f1';
            Chart.defaults.borderColor = '#444';
        } else {
            themeIcon.className = 'fas fa-sun';
            Chart.defaults.color = '#2c3e50';
            Chart.defaults.borderColor = '#dee2e6';
        }
    }
    
    // Update existing charts
    if (protocolChart) {
        protocolChart.update('none');
    }
    if (portChart) {
        portChart.update('none');
    }
}

// Setup process selection handlers
function setupProcessSelection() {
    const processPID = document.getElementById('processPID');
    const checkProcess = document.getElementById('checkProcess');
    const attachProcess = document.getElementById('attachProcess');
    const processInfo = document.getElementById('processInfo');
    
    // Handle PID input
    if (processPID) {
        processPID.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                checkProcess.click();
            }
        });
    }
    
    // Handle check process button
    if (checkProcess) {
        checkProcess.addEventListener('click', function() {
            const pid = processPID.value.trim();
            if (!pid) {
                showNotification('Veuillez entrer un PID', 'warning');
                return;
            }
            
            // Get process info from server
            if (socket && socket.connected) {
                socket.emit('getProcessInfo', { pid: parseInt(pid) });
            }
        });
    }
    
    // Handle attach process button
    if (attachProcess) {
        attachProcess.addEventListener('click', function() {
            if (currentProcessData) {
                selectedProcess = currentProcessData.pid;
                startProcessMonitoringMode();
            }
        });
    }
}

function startGlobalMonitoring() {
    currentMode = 'global';
    selectedProcess = null;
    
    // Clear previous data
    clearTables();
    
    // Update UI to show global mode
    updateModeIndicator('global');
    
    // Notify server to start global monitoring
    if (socket && socket.connected) {
        socket.emit('startGlobalMonitoring');
        showNotification('Global PC monitoring started', 'success');
    }
}

function startProcessMonitoringMode() {
    if (!selectedProcess) {
        showNotification('Please select a process first', 'warning');
        return;
    }
    
    currentMode = 'process';
    
    // Clear previous data
    clearTables();
    
    // Get process info from display
    const processName = document.getElementById('processName').textContent;
    const processInfo = { 
        name: processName !== '-' ? processName : 'Processus', 
        pid: selectedProcess 
    };
    
    // Update UI to show process mode
    updateModeIndicator('process', processInfo);
    
    // Hide process selection
    const processSelection = document.getElementById('processSelection');
    if (processSelection) {
        processSelection.style.display = 'none';
    }
    
    // Notify server to start process monitoring
    if (socket && socket.connected) {
        socket.emit('startProcessMonitoring', { pid: selectedProcess });
        showNotification(`Monitoring attaché au processus: ${processInfo.name} (PID: ${selectedProcess})`, 'success');
    }
}

// Cette fonction n'est plus nécessaire avec le nouveau système

function clearTables() {
    // Clear packets table
    const packetsTable = document.getElementById('packetsTable');
    if (packetsTable) {
        packetsTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted"><i class="fas fa-spinner fa-spin me-2"></i>En attente de données...</td></tr>';
    }
    
    // Clear connections list
    const connectionsList = document.getElementById('connectionsList');
    if (connectionsList) {
        connectionsList.innerHTML = '<p class="text-muted text-center"><i class="fas fa-spinner fa-spin me-2"></i>Chargement...</p>';
    }
    
    // Clear processes list
    const processesList = document.getElementById('processesList');
    if (processesList) {
        processesList.innerHTML = '<p class="text-muted text-center"><i class="fas fa-spinner fa-spin me-2"></i>Chargement...</p>';
    }
    
    // Clear domains list
    const domainsList = document.getElementById('domainsList');
    if (domainsList) {
        domainsList.innerHTML = '<p class="text-muted text-center"><i class="fas fa-spinner fa-spin me-2"></i>Chargement...</p>';
    }
    
    // Reset statistics
    const totalPackets = document.getElementById('totalPackets');
    const totalConnections = document.getElementById('totalConnections');
    const activeProcesses = document.getElementById('activeProcesses');
    const uniqueDomains = document.getElementById('uniqueDomains');
    
    if (totalPackets) totalPackets.textContent = '0';
    if (totalConnections) totalConnections.textContent = '0';
    if (activeProcesses) activeProcesses.textContent = '0';
    if (uniqueDomains) uniqueDomains.textContent = '0';
}

function updateModeIndicator(mode, processInfo = null) {
    const modeIndicator = document.getElementById('modeIndicator');
    const currentModeText = document.getElementById('currentModeText');
    const changeProcessBtn = document.getElementById('changeProcessBtn');
    
    if (modeIndicator && currentModeText) {
        if (mode === 'global') {
            modeIndicator.className = 'alert alert-info';
            currentModeText.innerHTML = '<i class="fas fa-globe me-2"></i>Surveillance Globale PC - Capture TOUT le trafic réseau';
            if (changeProcessBtn) changeProcessBtn.style.display = 'none';
        } else if (mode === 'process' && processInfo) {
            modeIndicator.className = 'alert alert-success';
            currentModeText.innerHTML = `<i class="fas fa-bullseye me-2"></i>Surveillance Processus - ${processInfo.name} (PID: ${processInfo.pid})`;
            if (changeProcessBtn) changeProcessBtn.style.display = 'inline-block';
        } else if (mode === 'process') {
            modeIndicator.className = 'alert alert-warning';
            currentModeText.innerHTML = '<i class="fas fa-bullseye me-2"></i>Surveillance Processus - Sélectionnez un processus';
            if (changeProcessBtn) changeProcessBtn.style.display = 'none';
        }
    }
}

function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
        showNotification('Connected to SilverMonitor server', 'success');
        document.body.classList.add('connected');
    });
    
    socket.on('disconnect', function() {
        console.log('Disconnected from server');
        showNotification('Disconnected from server', 'warning');
        document.body.classList.remove('connected');
    });
    
    socket.on('stats', function(data) {
        updateStats(data);
    });
    
    socket.on('packet', function(packet) {
        addPacket(packet);
    });
    
    socket.on('connection', function(connection) {
        addConnection(connection);
    });
    
    socket.on('processes', function(processList) {
        updateProcesses(processList);
    });
    
    socket.on('domains', function(domainsList) {
        updateDomains(domainsList);
    });
    
    socket.on('processesList', function(processes) {
        updateProcessesList(processes);
    });
    
    socket.on('error', function(error) {
        console.error('Socket error:', error);
        showNotification('Connection error: ' + error.message, 'error');
    });
    
    // Handle process info response from server
    socket.on('processInfo', function(processData) {
        const processInfo = document.getElementById('processInfo');
        const processPID = document.getElementById('processPID');
        
        if (processData && processData.pid) {
            // Store process data for attach button
            currentProcessData = processData;
            
            // Update display
            document.getElementById('processName').textContent = processData.name || 'Inconnu';
            document.getElementById('processPIDDisplay').textContent = processData.pid;
            document.getElementById('processCPU').textContent = (processData.cpu || 0).toFixed(1) + '%';
            document.getElementById('processMemory').textContent = formatBytes(processData.memory || 0);
            
            // Show process info
            if (processInfo) {
                processInfo.style.display = 'block';
            }
            
            showNotification(`Processus trouvé: ${processData.name}`, 'success');
        } else {
            currentProcessData = null;
            showNotification('Processus non trouvé', 'error');
            if (processInfo) {
                processInfo.style.display = 'none';
            }
        }
    });
}

function initializeCharts() {
    const protocolCanvas = document.getElementById('protocolChart');
    const portCanvas = document.getElementById('portChart');
    
    if (!protocolCanvas || !portCanvas) {
        console.warn('Chart canvases not found, skipping chart initialization');
        return;
    }
    
    const protocolCtx = protocolCanvas.getContext('2d');
    const portCtx = portCanvas.getContext('2d');
    
    protocolChart = new Chart(protocolCtx, {
        type: 'doughnut',
        data: {
            labels: ['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'ICMP', 'Autre'],
            datasets: [{
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#3498db', '#e74c3c', '#27ae60', '#f39c12', 
                    '#9b59b6', '#1abc9c', '#95a5a6'
                ],
                borderWidth: 2,
                borderColor: currentTheme === 'dark' ? '#444' : '#dee2e6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: currentTheme === 'dark' ? '#ecf0f1' : '#2c3e50'
                    }
                },
                title: {
                    display: true,
                    text: 'Répartition des Protocoles',
                    color: currentTheme === 'dark' ? '#ecf0f1' : '#2c3e50'
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
    
    portChart = new Chart(portCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Trafic par Port',
                data: [],
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Ports les Plus Utilisés',
                    color: currentTheme === 'dark' ? '#ecf0f1' : '#2c3e50'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: currentTheme === 'dark' ? '#444' : '#dee2e6'
                    },
                    ticks: {
                        color: currentTheme === 'dark' ? '#ecf0f1' : '#2c3e50'
                    }
                },
                x: {
                    grid: {
                        color: currentTheme === 'dark' ? '#444' : '#dee2e6'
                    },
                    ticks: {
                        color: currentTheme === 'dark' ? '#ecf0f1' : '#2c3e50'
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

async function loadInitialData() {
    try {
        const [stats, protocols, ports, domains] = await Promise.all([
            fetch('/api/stats').then(r => r.json()),
            fetch('/api/protocols').then(r => r.json()),
            fetch('/api/ports').then(r => r.json()),
            fetch('/api/domains').then(r => r.json())
        ]);
        
        updateStats(stats);
        updateProtocolChart(protocols);
        updatePortChart(ports);
        updateDomains(domains);
        
        showNotification('Initial data loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading initial data:', error);
        showNotification('Error loading initial data', 'error');
    }
}

function updateStats(data) {
    const elements = {
        totalPackets: document.getElementById('totalPackets'),
        totalConnections: document.getElementById('totalConnections'),
        activeProcesses: document.getElementById('activeProcesses'),
        uniqueDomains: document.getElementById('uniqueDomains')
    };
    
    // Animate number changes
    Object.keys(elements).forEach(key => {
        const element = elements[key];
        const newValue = data[key] || 0;
        const currentValue = parseInt(element.textContent) || 0;
        
        if (newValue !== currentValue) {
            animateNumber(element, currentValue, newValue);
        }
    });
}

function animateNumber(element, start, end) {
    const duration = 1000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (end - start) * easeOutQuart);
        
        element.textContent = current.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = end.toLocaleString();
        }
    }
    
    requestAnimationFrame(update);
}

function addPacket(packet) {
    const table = document.getElementById('packetsTable');
    if (!table) return;
    
    // Remove loading message if present
    const loadingRow = table.querySelector('tr td[colspan]');
    if (loadingRow) {
        loadingRow.parentElement.remove();
    }
    
    const row = document.createElement('tr');
    row.className = 'packet-row';
    row.style.animation = 'slideInRight 0.5s ease-out';
    row.style.cursor = 'pointer';
    
    // Format domain display
    const domainDisplay = packet.domain ? 
        `<span class="badge bg-info">${packet.domain}</span>` : 
        '<span class="text-muted">-</span>';
    
    row.innerHTML = `
        <td>${formatTime(packet.timestamp)}</td>
        <td><span class="badge bg-primary">${packet.protocol}</span></td>
        <td>${packet.source}</td>
        <td>${packet.destination}</td>
        <td>${domainDisplay}</td>
        <td>${formatBytes(packet.size)}</td>
        <td><span class="item-type packet">Packet</span></td>
    `;
    
    // Add click event to show packet details
    row.addEventListener('click', () => {
        showPacketDetails(packet);
    });
    
    // Add hover effect
    row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = currentTheme === 'dark' ? '#4a4a4a' : '#e9ecef';
    });
    
    row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
    });
    
    table.insertBefore(row, table.firstChild);
    
    // Limit the number of displayed packets
    const maxPackets = 50;
    const rows = table.querySelectorAll('tr');
    if (rows.length > maxPackets) {
        rows[rows.length - 1].remove();
    }
    
    // Add highlight effect
    row.style.backgroundColor = currentTheme === 'dark' ? '#3a3a3a' : '#f8f9fa';
    setTimeout(() => {
        row.style.backgroundColor = '';
    }, 1000);
}

function addConnection(connection) {
    const container = document.getElementById('connectionsList');
    if (!container) return;
    
    // Remove loading message if present
    const loadingDiv = container.querySelector('.text-center');
    if (loadingDiv) {
        loadingDiv.remove();
    }
    
    const item = document.createElement('div');
    item.className = 'list-group-item connection-item';
    item.style.animation = 'slideInLeft 0.5s ease-out';
    
    // Resolve domain for display
    const domainDisplay = connection.domain ? 
        `<br><small class="text-info"><i class="fas fa-globe me-1"></i>${connection.domain}</small>` : '';
    
    item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <strong>${connection.localAddress}:${connection.localPort}</strong>
                <br>
                <small class="text-muted">→ ${connection.remoteAddress}:${connection.remotePort}</small>
                ${domainDisplay}
            </div>
            <span class="item-type connection">Connection</span>
        </div>
        <div class="mt-2">
            <small class="text-muted">
                <i class="fas fa-cog me-1"></i>${connection.state || 'ESTABLISHED'}
                <span class="ms-2"><i class="fas fa-clock me-1"></i>${formatTime(connection.timestamp)}</span>
            </small>
        </div>
    `;
    
    container.insertBefore(item, container.firstChild);
    
    // Limit the number of displayed connections
    const maxConnections = 20;
    const items = container.querySelectorAll('.list-group-item');
    if (items.length > maxConnections) {
        items[items.length - 1].remove();
    }
    
    // Add highlight effect
    item.style.backgroundColor = currentTheme === 'dark' ? '#3a3a3a' : '#f8f9fa';
    setTimeout(() => {
        item.style.backgroundColor = '';
    }, 1000);
}

function updateProcesses(processList) {
    const container = document.getElementById('processesList');
    if (!container) return;
    
    // Remove loading message if present
    const loadingDiv = container.querySelector('.text-center');
    if (loadingDiv) {
        loadingDiv.remove();
    }
    
    container.innerHTML = '';
    
    processList.slice(0, 15).forEach(process => {
        const item = document.createElement('div');
        item.className = 'list-group-item process-item';
        item.style.animation = 'fadeInUp 0.6s ease-out';
        
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${process.name}</strong>
                    <br>
                    <small class="text-muted">PID: ${process.pid}</small>
                </div>
                <span class="item-type process">Process</span>
            </div>
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fas fa-memory me-1"></i>${formatBytes(process.memory || 0)}
                    <span class="ms-2"><i class="fas fa-microchip me-1"></i>${(process.cpu || 0).toFixed(1)}%</span>
                </small>
            </div>
        `;
        
        container.appendChild(item);
    });
}

function updateDomains(domainsList) {
    const container = document.getElementById('domainsList');
    if (!container) return;
    
    // Remove loading message if present
    const loadingDiv = container.querySelector('.text-center');
    if (loadingDiv) {
        loadingDiv.remove();
    }
    
    container.innerHTML = '';
    
    domainsList.slice(0, 10).forEach(domain => {
        const item = document.createElement('div');
        item.className = 'list-group-item domain-item';
        item.style.animation = 'fadeInUp 0.6s ease-out';
        
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${domain.domain}</strong>
                    <br>
                    <small class="text-muted">${domain.ip}</small>
                </div>
                <span class="item-type domain">Domain</span>
            </div>
            <div class="mt-2">
                <small class="text-muted">
                    <i class="fas fa-chart-line me-1"></i>${domain.count} requests
                    <span class="ms-2"><i class="fas fa-clock me-1"></i>${formatTime(domain.lastSeen)}</span>
                </small>
            </div>
        `;
        
        container.appendChild(item);
    });
}

function updateProtocolChart(protocols) {
    if (!protocolChart) return;
    
    const labels = Object.keys(protocols);
    const data = Object.values(protocols);
    
    protocolChart.data.labels = labels;
    protocolChart.data.datasets[0].data = data;
    
    // Update colors based on theme
    const colors = currentTheme === 'dark' 
        ? ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c', '#95a5a6']
        : ['#2980b9', '#c0392b', '#229954', '#d68910', '#8e44ad', '#16a085', '#7f8c8d'];
    
    protocolChart.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
    protocolChart.data.datasets[0].borderColor = currentTheme === 'dark' ? '#444' : '#dee2e6';
    
    protocolChart.update('active');
}

function updatePortChart(ports) {
    if (!portChart) return;
    
    const labels = ports.map(p => p.port);
    const data = ports.map(p => p.count);
    
    portChart.data.labels = labels;
    portChart.data.datasets[0].data = data;
    
    // Update colors based on theme
    portChart.data.datasets[0].backgroundColor = currentTheme === 'dark' ? '#3498db' : '#2980b9';
    portChart.data.datasets[0].borderColor = currentTheme === 'dark' ? '#2980b9' : '#1f5f8b';
    
    portChart.update('active');
}

function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
        return 'À l\'instant';
    } else if (diff < 3600000) { // Less than 1 hour
        return `Il y a ${Math.floor(diff / 60000)}m`;
    } else if (diff < 86400000) { // Less than 1 day
        return `Il y a ${Math.floor(diff / 3600000)}h`;
    } else {
        return date.toLocaleDateString();
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showPacketDetails(packet) {
    const modal = new bootstrap.Modal(document.getElementById('packetDetailsModal'));
    const content = document.getElementById('packetDetailsContent');
    
    const details = `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-info-circle me-2"></i>Informations Générales</h6>
                <table class="table table-sm">
                    <tr><td><strong>ID:</strong></td><td>${packet.id}</td></tr>
                    <tr><td><strong>Timestamp:</strong></td><td>${formatTime(packet.timestamp)}</td></tr>
                    <tr><td><strong>Protocole:</strong></td><td><span class="badge bg-primary">${packet.protocol}</span></td></tr>
                    <tr><td><strong>Taille:</strong></td><td>${formatBytes(packet.size)}</td></tr>
                    <tr><td><strong>PID:</strong></td><td>${packet.pid || 'N/A'}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-network-wired me-2"></i>Adresses</h6>
                <table class="table table-sm">
                    <tr><td><strong>Source:</strong></td><td>${packet.source}</td></tr>
                    <tr><td><strong>Destination:</strong></td><td>${packet.destination}</td></tr>
                    <tr><td><strong>Domaine:</strong></td><td>${packet.domain ? `<span class="badge bg-info">${packet.domain}</span>` : 'Non résolu'}</td></tr>
                </table>
            </div>
        </div>
        
        <div class="row mt-3">
            <div class="col-12">
                <h6><i class="fas fa-cogs me-2"></i>Détails Techniques</h6>
                <table class="table table-sm">
                    <tr><td><strong>Flags:</strong></td><td>${packet.flags || 'N/A'}</td></tr>
                    <tr><td><strong>Détails:</strong></td><td>${packet.details || 'N/A'}</td></tr>
                    <tr><td><strong>Type:</strong></td><td>${packet.isActivity ? 'Activité détectée' : 'Nouvelle connexion'}</td></tr>
                </table>
            </div>
        </div>
        
        ${packet.connection ? `
        <div class="row mt-3">
            <div class="col-12">
                <h6><i class="fas fa-plug me-2"></i>Informations de Connexion</h6>
                <table class="table table-sm">
                    <tr><td><strong>État:</strong></td><td><span class="badge bg-success">${packet.connection.state}</span></td></tr>
                    <tr><td><strong>Port Local:</strong></td><td>${packet.connection.localPort}</td></tr>
                    <tr><td><strong>Port Distant:</strong></td><td>${packet.connection.remotePort}</td></tr>
                    <tr><td><strong>Adresse Locale:</strong></td><td>${packet.connection.localAddress}</td></tr>
                    <tr><td><strong>Adresse Distante:</strong></td><td>${packet.connection.remoteAddress}</td></tr>
                </table>
            </div>
        </div>
        ` : ''}
    `;
    
    content.innerHTML = details;
    modal.show();
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    const notification = document.createElement('div');
    notification.className = `notification alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Global error handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('An error occurred: ' + e.error.message, 'error');
});

// Cette fonction n'est plus nécessaire avec le nouveau système

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('Network error: ' + e.reason.message, 'error');
});

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 't':
                e.preventDefault();
                const themeToggle = document.querySelector('.theme-toggle');
                if (themeToggle) themeToggle.click();
                break;
            case 'r':
                e.preventDefault();
                location.reload();
                break;
        }
    }
});

// Global function for theme toggle (called from HTML)
function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    showNotification(`Theme switched to ${newTheme} mode`, 'info');
}

// Add smooth scrolling for better UX
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
}); 