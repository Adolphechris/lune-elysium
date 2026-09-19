module.exports = {
  apps: [
    {
      name: 'lune-elysium',
      script: './src/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4173,
        LUNE_TARGET: '/home/adolphe/CNEL -ELYSIUM/clenel-elysium'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'lune-tunnel',
      script: './scripts/tunnel.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 4173,
        TUNNEL_SUBDOMAIN: 'lune-elysium'
      },
      error_file: './logs/tunnel-error.log',
      out_file: './logs/tunnel-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
