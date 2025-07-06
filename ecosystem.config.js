module.exports = {
  apps: [{
    name: 'discord-github-bot',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    // ログ設定
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 再起動設定
    min_uptime: '10s',
    max_restarts: 10,
    
    // 環境変数ファイル
    env_file: '.env'
  }]
};