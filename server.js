
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;

// Logging Configuration
const LOG_DIR = process.env.LOG_DIR || '/app/logs';
let FILE_LOGGING_ENABLED = false;

// Initialize Logging
if (fs.existsSync(LOG_DIR)) {
    FILE_LOGGING_ENABLED = true;
    console.log(`[${new Date().toISOString()}] Logging to file enabled: ${LOG_DIR}`);
} else {
    console.log(`[${new Date().toISOString()}] File logging disabled (Directory ${LOG_DIR} not found). Mount a volume to enable.`);
}

/**
 * Centralized Logger
 * Handles console output (Docker logs) and file persistence
 */
function writeLog(level, message, data = null) {
    const timestamp = new Date().toISOString();

    // Construct log entry object
    const logEntry = {
        timestamp,
        level,
        message,
        ...data
    };

    // 1. Write to Console (Stdout/Stderr) - Human Readable
    // Format: [TIME] [LEVEL] Message [Key=Value, ...]
    let dataStr = '';
    if (data) {
        // Flatten data for readability, excluding large objects if any
        try {
            dataStr = Object.entries(data)
                .map(([k, v]) => {
                    if (typeof v === 'object' && v !== null) return ''; // Skip nested objects for cleaner console
                    return `${k}=${v}`;
                })
                .filter(s => s)
                .join(', ');

            if (dataStr) dataStr = `[${dataStr}]`;
        } catch (e) { dataStr = ''; }
    }

    const consoleLog = `[${timestamp}] [${level}] ${message} ${dataStr}`.trim();

    if (level === 'ERROR') {
        console.error(consoleLog);
    } else {
        console.log(consoleLog);
    }

    // 2. Write to File (if enabled)
    if (FILE_LOGGING_ENABLED) {
        const logString = JSON.stringify(logEntry);

        // Rotate logs by date (simple YYYY-MM-DD.log)
        const dateStr = timestamp.split('T')[0];
        const logFile = path.join(LOG_DIR, `app-${dateStr}.log`);

        // Append newline
        fs.appendFile(logFile, logString + '\n', (err) => {
            if (err) console.error(`Failed to write to log file: ${err.message}`);
        });
    }
}

// Stats tracking
const stats = {
    processedCount: 0,
    visitors: new Set(),
    startTime: new Date()
};

// Custom token for real IP
morgan.token('real-ip', (req) => {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
});

// Use morgan for HTTP logs, but pipe to our logger
// We use a custom format string to generate the message, then pass it to stream
app.use(morgan(':real-ip - :method :url :status :res[content-length] - :response-time ms', {
    skip: (req, res) => {
        // Skip logs for static assets to reduce noise
        return req.url.match(/\.(js|css|png|jpg|ico|svg|map|woff2?)$/);
    },
    stream: {
        write: (message) => {
            writeLog('HTTP', message.trim());
        }
    }
}));

app.use(cors());
app.use(express.json());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// API Endpoint for Client Logs
app.post('/api/log', (req, res) => {
    const { level, message, details } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Update stats
    stats.visitors.add(ip);

    if (message === 'Starting image processing') {
        stats.processedCount++;
    }

    // Log the client event
    writeLog(level || 'INFO', message, {
        source: 'client',
        ip,
        stats: message === 'Starting image processing' ?
            { totalProcessed: stats.processedCount, uniqueVisitors: stats.visitors.size } : undefined,
        details: details || {}
    });

    res.status(200).send('Log received');
});

// Log main page visits explicitly
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        stats.visitors.add(ip);

        writeLog('INFO', 'New Visitor', {
            source: 'server',
            type: 'visit',
            ip: ip,
            visitors: stats.visitors.size,
            processed: stats.processedCount
        });
    }
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    writeLog('INFO', `Server running on port ${PORT}`);
    writeLog('INFO', `Serving static files from ${path.join(__dirname, 'dist')}`);
    if (FILE_LOGGING_ENABLED) {
        writeLog('INFO', `File logging active in ${LOG_DIR}`);
    }
});
