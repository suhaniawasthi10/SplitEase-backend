/**
 * PM2 Ecosystem Configuration for SplitEase (Static Files Version)
 * 
 * This configuration serves the frontend directly via Nginx static files
 * instead of running a Vite preview server. This is the recommended 
 * approach for production since Nginx is more efficient for static files.
 * 
 * Usage from /var/www/html directory:
 *   pm2 start ecosystem.static.config.cjs
 *   pm2 restart splitease-backend
 *   pm2 logs
 *   pm2 status
 */

module.exports = {
    apps: [
        {
            name: 'splitease-backend',
            cwd: '/var/www/html/SplitEase-backend',
            script: 'index.js',
            interpreter: 'node',
            node_args: '--experimental-modules',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
                PORT: 8002
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 8002
            },
            // Logging
            log_file: '/var/www/html/logs/splitease-backend.log',
            out_file: '/var/www/html/logs/splitease-backend-out.log',
            error_file: '/var/www/html/logs/splitease-backend-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            // Restart strategy
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            min_uptime: '10s',
            // Graceful shutdown
            kill_timeout: 5000,
            listen_timeout: 10000
        }
    ]
};
