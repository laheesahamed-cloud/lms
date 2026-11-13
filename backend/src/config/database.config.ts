export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  bodyLimit: process.env.BODY_LIMIT || '8mb',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'lms_db',
    // Kept below the host's per-account connection cap: during a restart the old
    // and new copy of the app overlap, so two pools must fit inside it together.
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '4', 10),
    // Idle connections still count against the host's cap. Keep one at most and
    // close it after 10s unused, so a restart overlap is not two pools' worth of
    // idle connections sitting open for a minute.
    maxIdle: parseInt(process.env.DB_MAX_IDLE || '1', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '10000', 10),
    connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '100', 10),
  },
});
