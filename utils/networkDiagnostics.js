// utils/networkDiagnostics.js
import { exec } from "child_process";
import { promisify } from "util";
import WebSocket from "ws";

const execAsync = promisify(exec);

/**
 * Diagnose network connectivity issues
 */
export const diagnoseNetwork = async () => {
  console.log("🔍 Running network diagnostics...");

  try {
    // Check DNS resolution preference
    console.log("\n📡 DNS Configuration:");
    try {
      const { stdout } = await execAsync(
        'cat /etc/gai.conf 2>/dev/null || echo "gai.conf not found"'
      );
      console.log("GAI Config:", stdout.trim());
    } catch (error) {
      console.log("Could not read gai.conf");
    }

    // Test IPv4/IPv6 connectivity
    console.log("\n🌐 IP Connectivity Test:");
    try {
      const { stdout: ipv4 } = await execAsync(
        'curl -4 -s --max-time 5 https://ipv4.icanhazip.com/ || echo "IPv4 failed"'
      );
      console.log("IPv4 Address:", ipv4.trim());
    } catch (error) {
      console.log("IPv4 test failed:", error.message);
    }

    try {
      const { stdout: ipv6 } = await execAsync(
        'curl -6 -s --max-time 5 https://ipv6.icanhazip.com/ || echo "IPv6 failed"'
      );
      console.log("IPv6 Address:", ipv6.trim());
    } catch (error) {
      console.log("IPv6 test failed:", error.message);
    }

    // Test Nostr relay connectivity
    console.log("\n⚡ Nostr Relay Connectivity:");
    const relays = [
      "wss://relay.damus.io",
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://relay.nostr.band",
    ];

    for (const relay of relays) {
      await testWebSocketConnection(relay);
    }
  } catch (error) {
    console.error("Network diagnostics failed:", error);
  }
};

/**
 * Test WebSocket connection to a relay
 */
const testWebSocketConnection = async (url) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    const ws = new WebSocket(url, {
      family: 4, // Force IPv4
      timeout: 10000,
      handshakeTimeout: 10000,
    });

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };

    ws.on("open", () => {
      const duration = Date.now() - startTime;
      console.log(`✅ ${url} - Connected in ${duration}ms (IPv4)`);
      cleanup();
      resolve(true);
    });

    ws.on("error", (error) => {
      console.log(`❌ ${url} - Failed: ${error.message}`);
      cleanup();
      resolve(false);
    });

    setTimeout(() => {
      if (!resolved) {
        console.log(`⏰ ${url} - Timeout (10s)`);
        cleanup();
        resolve(false);
      }
    }, 10000);
  });
};

/**
 * Get system network information
 */
export const getNetworkInfo = async () => {
  try {
    console.log("\n📊 System Network Information:");

    // Get network interfaces
    const { stdout: interfaces } = await execAsync(
      'ip addr show | grep -E "inet|inet6" | head -10'
    );
    console.log("Network Interfaces:\n", interfaces);

    // Get routing table
    const { stdout: routes } = await execAsync("ip route show | head -5");
    console.log("IPv4 Routes:\n", routes);

    // Check if IPv6 is enabled
    const { stdout: ipv6Status } = await execAsync(
      'cat /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null || echo "unknown"'
    );
    console.log("IPv6 Disabled:", ipv6Status.trim() === "1" ? "Yes" : "No");
  } catch (error) {
    console.error("Could not get network info:", error.message);
  }
};
