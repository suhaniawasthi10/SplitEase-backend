/**
 * PM2 Ecosystem Configuration for SplitEase
 * 
 * Usage from /var/www/html directory:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart all
 *   pm2 stop all
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
            instances: 1,
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
            min_uptime: '10s'
        },
        {
            name: 'splitease-frontend',
            cwd: '/var/www/html/SplitEase',
            script: 'npm',
            args: 'run preview -- --host 0.0.0.0 --port 4173',
            interpreter: 'none',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'production'
            },
            env_production: {
                NODE_ENV: 'production'
            },
            // Logging
            log_file: '/var/www/html/logs/splitease-frontend.log',
            out_file: '/var/www/html/logs/splitease-frontend-out.log',
            error_file: '/var/www/html/logs/splitease-frontend-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            // Restart strategy
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            min_uptime: '10s'
        }
    ]
};
