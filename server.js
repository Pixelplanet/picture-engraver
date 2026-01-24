
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;

// Enable robust HTTP logging
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// API Endpoint for Client Logs
app.post('/api/log', (req, res) => {
    const { level, message, details, timestamp } = req.body;

    // Format log for console (Docker logs)
    const logEntry = JSON.stringify({
        source: 'client',
        timestamp: timestamp || new Date().toISOString(),
        level: level || 'INFO',
        message: message,
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
