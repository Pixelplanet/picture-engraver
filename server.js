
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;

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

// Tone down logging: Skip static files
app.use(morgan(':real-ip - :method :url :status :res[content-length] - :response-time ms', {
    skip: (req, res) => {
        // Skip logs for static assets to reduce noise
        return req.url.match(/\.(js|css|png|jpg|ico|svg|map|woff2?)$/);
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

    // Format log for console (Docker logs)
    // Only print meaningful application logs
    const logEntry = JSON.stringify({
        source: 'client',
        time: new Date().toLocaleTimeString(),
        ip: ip,
        level: level || 'INFO',
        message: message,
        // Include stats in relevant logs
        stats: message === 'Starting image processing' ?
            { totalProcessed: stats.processedCount, uniqueVisitors: stats.visitors.size } : undefined,
        details: details || {}
    });

    // Write to stdout/stderr based on level
    if (level === 'ERROR') {
        console.error(logEntry);
    } else {
        console.log(logEntry);
    }

    res.status(200).send('Log received');
});

// Log main page visits explicitly
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        stats.visitors.add(ip);
        console.log(JSON.stringify({
            source: 'server',
            type: 'visit',
            ip: ip,
            visitors: stats.visitors.size,
            processed: stats.processedCount
        }));
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
    console.log(`Server running on port ${PORT}`);
    console.log(`Serving static files from ${path.join(__dirname, 'dist')}`);
});
