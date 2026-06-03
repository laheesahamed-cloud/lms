declare const _default: () => {
    port: number;
    frontendUrl: string;
    bodyLimit: string;
    database: {
        host: string;
        port: number;
        user: string;
        password: string;
        name: string;
        connectionLimit: number;
        maxIdle: number;
        idleTimeout: number;
        connectTimeout: number;
        queueLimit: number;
    };
};
export default _default;
