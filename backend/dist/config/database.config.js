"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function poolSize() {
    const wanted = parseInt(process.env.DB_CONNECTION_LIMIT || '4', 10);
    const cap = parseInt(process.env.DB_MAX_USER_CONNECTIONS || '0', 10);
    if (!cap || cap < 3)
        return wanted;
    const safe = Math.max(1, Math.floor((cap - 1) / 2));
    if (wanted > safe) {
        console.warn(`[database] DB_CONNECTION_LIMIT=${wanted} is too high for DB_MAX_USER_CONNECTIONS=${cap}; using ${safe} so a restart overlap stays under the cap.`);
        return safe;
    }
    return wanted;
}
exports.default = () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
    bodyLimit: process.env.BODY_LIMIT || '8mb',
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        name: process.env.DB_NAME || 'lms_db',
        connectionLimit: poolSize(),
        maxIdle: parseInt(process.env.DB_MAX_IDLE || '1', 10),
        idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10),
        connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
        queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '100', 10),
    },
});
//# sourceMappingURL=database.config.js.map