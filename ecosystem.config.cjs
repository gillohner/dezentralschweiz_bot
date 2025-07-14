// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "dezentralschweiz_bot",
      script: "./bot.js",
      cwd: "/root/dezentralschweiz_bot",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        // Force IPv4 only
        // Disable IPv6 completely for Node.js
        UV_USE_IO_URING: "0",
        // Force IPv4 for network operations
        PREFER_IPV4: "1",
      },
      node_args: "--dns-result-order=ipv4first --max-old-space-size=512",
      // Additional PM2 options
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
    },
  ],
};
