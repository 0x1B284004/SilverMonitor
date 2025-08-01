const HTTPParser = require('http-parser-js');

class ProtocolAnalyzer {
  constructor() {
    this.httpParser = new HTTPParser();
    this.knownPorts = this.getKnownPorts();
  }

  analyze(packet) {
    const analysis = {
      protocol: packet.protocol,
      details: null,
      application: null,
      flags: null,
      payload: null
    };

    // Analyser selon le protocole
    switch (packet.protocol) {
      case 'TCP':
        return this.analyzeTCP(packet, analysis);
      case 'UDP':
        return this.analyzeUDP(packet, analysis);
      case 'HTTP':
        return this.analyzeHTTP(packet, analysis);
      case 'HTTPS':
        return this.analyzeHTTPS(packet, analysis);
      case 'DNS':
        return this.analyzeDNS(packet, analysis);
      case 'ICMP':
        return this.analyzeICMP(packet, analysis);
      default:
        return this.analyzeGeneric(packet, analysis);
    }
  }

  analyzeTCP(packet, analysis) {
    // Identifier l'application par port
    analysis.application = this.identifyApplicationByPort(packet.destination.port);
    
    // Analyser les flags TCP si disponibles
    if (packet.raw && packet.raw.length > 20) {
      const tcpHeader = packet.raw.slice(20, 40);
      analysis.flags = this.parseTCPFlags(tcpHeader);
    }

    // Analyser le contenu selon le port
    if (packet.destination.port === 80 || packet.destination.port === 443) {
      analysis.details = `Web traffic to ${packet.destination.ip}`;
    } else if (packet.destination.port === 22) {
      analysis.details = 'SSH connection';
    } else if (packet.destination.port === 21) {
      analysis.details = 'FTP connection';
    } else if (packet.destination.port === 25 || packet.destination.port === 587) {
      analysis.details = 'SMTP email traffic';
    } else if (packet.destination.port === 110 || packet.destination.port === 995) {
      analysis.details = 'POP3 email traffic';
    } else if (packet.destination.port === 143 || packet.destination.port === 993) {
      analysis.details = 'IMAP email traffic';
    } else if (packet.destination.port === 53) {
      analysis.details = 'DNS over TCP';
    } else {
      analysis.details = `TCP connection to port ${packet.destination.port}`;
    }

    return analysis;
  }

  analyzeUDP(packet, analysis) {
    // Identifier l'application par port
    analysis.application = this.identifyApplicationByPort(packet.destination.port);
    
    if (packet.destination.port === 53) {
      analysis.details = 'DNS query';
    } else if (packet.destination.port === 67 || packet.destination.port === 68) {
      analysis.details = 'DHCP traffic';
    } else if (packet.destination.port === 123) {
      analysis.details = 'NTP time sync';
    } else if (packet.destination.port === 161 || packet.destination.port === 162) {
      analysis.details = 'SNMP management';
    } else if (packet.destination.port === 514) {
      analysis.details = 'Syslog traffic';
    } else {
      analysis.details = `UDP traffic to port ${packet.destination.port}`;
    }

    return analysis;
  }

  analyzeHTTP(packet, analysis) {
    analysis.application = 'HTTP';
    analysis.details = 'HTTP web traffic';
    
    // Essayer de parser le contenu HTTP si disponible
    if (packet.raw && packet.raw.length > 40) {
      try {
        const httpData = packet.raw.slice(40);
        const httpInfo = this.parseHTTP(httpData);
        if (httpInfo) {
          analysis.details = httpInfo;
        }
      } catch (error) {
        // Ignorer les erreurs de parsing HTTP
      }
    }

    return analysis;
  }

  analyzeHTTPS(packet, analysis) {
    analysis.application = 'HTTPS';
    analysis.details = 'Encrypted HTTPS traffic';
    
    // Pour HTTPS, on ne peut pas voir le contenu mais on peut identifier le domaine
    if (packet.destination.domain) {
      analysis.details = `HTTPS to ${packet.destination.domain}`;
    }

    return analysis;
  }

  analyzeDNS(packet, analysis) {
    analysis.application = 'DNS';
    analysis.details = 'DNS query/response';
    
    // Essayer d'extraire des informations DNS si disponibles
    if (packet.raw && packet.raw.length > 40) {
      try {
        const dnsData = packet.raw.slice(40);
        const dnsInfo = this.parseDNS(dnsData);
        if (dnsInfo) {
          analysis.details = dnsInfo;
        }
      } catch (error) {
        // Ignorer les erreurs de parsing DNS
      }
    }

    return analysis;
  }

  analyzeICMP(packet, analysis) {
    analysis.application = 'ICMP';
    analysis.details = 'ICMP control message';
    
    // Analyser le type ICMP si disponible
    if (packet.raw && packet.raw.length > 20) {
      const icmpType = packet.raw[20];
      analysis.details = this.getICMPTypeDescription(icmpType);
    }

    return analysis;
  }

  analyzeGeneric(packet, analysis) {
    analysis.application = 'Unknown';
    analysis.details = `${packet.protocol} traffic`;
    return analysis;
  }

  identifyApplicationByPort(port) {
    return this.knownPorts[port] || 'Unknown';
  }

  parseTCPFlags(tcpHeader) {
    if (tcpHeader.length < 13) return null;
    
    const flags = tcpHeader[13];
    return {
      FIN: (flags & 0x01) !== 0,
      SYN: (flags & 0x02) !== 0,
      RST: (flags & 0x04) !== 0,
      PSH: (flags & 0x08) !== 0,
      ACK: (flags & 0x10) !== 0,
      URG: (flags & 0x20) !== 0
    };
  }

  parseHTTP(httpData) {
    try {
      const httpString = httpData.toString('utf8');
      const lines = httpString.split('\r\n');
      
      if (lines.length > 0) {
        const firstLine = lines[0];
        if (firstLine.startsWith('GET ')) {
          const path = firstLine.split(' ')[1];
          return `HTTP GET ${path}`;
        } else if (firstLine.startsWith('POST ')) {
          const path = firstLine.split(' ')[1];
          return `HTTP POST ${path}`;
        } else if (firstLine.startsWith('HTTP/')) {
          const parts = firstLine.split(' ');
          if (parts.length >= 2) {
            return `HTTP Response ${parts[1]}`;
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs de parsing
    }
    
    return null;
  }

  parseDNS(dnsData) {
    try {
      // Parsing basique DNS
      if (dnsData.length < 12) return null;
      
      const flags = dnsData[2] << 8 | dnsData[3];
      const isQuery = (flags & 0x8000) === 0;
      const isResponse = (flags & 0x8000) !== 0;
      
      if (isQuery) {
        return 'DNS Query';
      } else if (isResponse) {
        return 'DNS Response';
      }
    } catch (error) {
      // Ignorer les erreurs de parsing
    }
    
    return null;
  }

  getICMPTypeDescription(type) {
    const icmpTypes = {
      0: 'Echo Reply (Ping)',
      3: 'Destination Unreachable',
      5: 'Redirect',
      8: 'Echo Request (Ping)',
      11: 'Time Exceeded',
      13: 'Timestamp Request',
      14: 'Timestamp Reply',
      17: 'Address Mask Request',
      18: 'Address Mask Reply'
    };
    
    return icmpTypes[type] || `ICMP Type ${type}`;
  }

  getKnownPorts() {
    return {
      // Web
      80: 'HTTP',
      443: 'HTTPS',
      8080: 'HTTP-Alt',
      8443: 'HTTPS-Alt',
      
      // Email
      25: 'SMTP',
      110: 'POP3',
      143: 'IMAP',
      465: 'SMTPS',
      587: 'SMTP-Submission',
      993: 'IMAPS',
      995: 'POP3S',
      
      // File Transfer
      21: 'FTP',
      22: 'SSH',
      23: 'Telnet',
      69: 'TFTP',
      
      // DNS & Network Services
      53: 'DNS',
      67: 'DHCP-Server',
      68: 'DHCP-Client',
      123: 'NTP',
      161: 'SNMP',
      162: 'SNMP-Trap',
      514: 'Syslog',
      
      // Database
      1433: 'MSSQL',
      3306: 'MySQL',
      5432: 'PostgreSQL',
      6379: 'Redis',
      27017: 'MongoDB',
      
      // Remote Desktop
      3389: 'RDP',
      5900: 'VNC',
      
      // Gaming & Media
      25565: 'Minecraft',
      27015: 'Steam',
      3478: 'STUN',
      5349: 'STUN-S',
      
      // Development
      3000: 'Node.js',
      5000: 'Flask',
      8000: 'Django',
      8081: 'React Dev',
      9000: 'Jenkins',
      
      // Monitoring
      9100: 'Prometheus',
      9090: 'Prometheus-Web',
      3001: 'Grafana',
      15672: 'RabbitMQ-Management',
      8161: 'ActiveMQ-Admin'
    };
  }

  // Méthodes utilitaires pour l'analyse avancée
  isEncryptedTraffic(packet) {
    const encryptedPorts = [443, 993, 995, 465, 8443];
    return encryptedPorts.includes(packet.destination.port);
  }

  isWebTraffic(packet) {
    const webPorts = [80, 443, 8080, 8443];
    return webPorts.includes(packet.destination.port);
  }

  isEmailTraffic(packet) {
    const emailPorts = [25, 110, 143, 465, 587, 993, 995];
    return emailPorts.includes(packet.destination.port);
  }

  isFileTransferTraffic(packet) {
    const ftPorts = [21, 22, 23, 69];
    return ftPorts.includes(packet.destination.port);
  }

  getTrafficCategory(packet) {
    if (this.isWebTraffic(packet)) return 'Web';
    if (this.isEmailTraffic(packet)) return 'Email';
    if (this.isFileTransferTraffic(packet)) return 'File Transfer';
    if (this.isEncryptedTraffic(packet)) return 'Encrypted';
    return 'Other';
  }
}

module.exports = ProtocolAnalyzer; 