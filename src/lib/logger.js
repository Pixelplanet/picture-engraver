
/**
 * Logger utility to send logs to the backend server
 */
export const Logger = {
    /**
     * Send a log message to the server
     * @param {string} level - INFO, WARN, ERROR
     * @param {string} message - The log message
     * @param {Object} details - Optional details/metadata
     */
    async log(level, message, details = {}) {
        // Always log to console locally
        if (level === 'ERROR') {
            console.error(`[${level}] ${message}`, details);
        } else if (level === 'WARN') {
            console.warn(`[${level}] ${message}`, details);
        } else {
            console.log(`[${level}] ${message}`, details);
        }

        // Send to backend (fire and forget)
        try {
            fetch('/api/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    level,
                    message,
                    details,
                    timestamp: new Date().toISOString()
                })
            }).catch(e => {
                // Ignore network errors for logs to prevent loops
                // console.error('Failed to send log:', e);
            });
        } catch (e) {
            // Ignore
        }
    },

    info(message, details) {
        this.log('INFO', message, details);
    },

    warn(message, details) {
        this.log('WARN', message, details);
    },

    error(message, details) {
        this.log('ERROR', message, details);
    }
};
