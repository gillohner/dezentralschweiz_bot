// utils/ipv4RelayResolver.js
import { lookup } from "dns";
import { promisify } from "util";

const dnsLookup = promisify(lookup);

/**
 * Resolve relay URLs to IPv4 addresses
 * @param {string[]} relayUrls - Array of relay WebSocket URLs
 * @returns {Promise<string[]>} - Array of IPv4-resolved URLs
 */
export const resolveRelaysToIPv4 = async (relayUrls) => {
  const resolvedUrls = [];

  for (const url of relayUrls) {
    try {
      const resolvedUrl = await resolveUrlToIPv4(url);
      resolvedUrls.push(resolvedUrl);
      console.log(`✅ Resolved ${url} -> ${resolvedUrl}`);
    } catch (error) {
      console.warn(`⚠️ Failed to resolve ${url}: ${error.message}`);
      // Keep original URL as fallback
      resolvedUrls.push(url);
    }
  }

  return resolvedUrls;
};

/**
 * Resolve a single WebSocket URL to IPv4
 * @param {string} url - WebSocket URL
 * @returns {Promise<string>} - IPv4-resolved URL
 */
const resolveUrlToIPv4 = async (url) => {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  // Skip if already an IP address
  if (isIPAddress(hostname)) {
    return url;
  }

  try {
    // Force IPv4 resolution
    const address = await dnsLookup(hostname, { family: 4 });
    urlObj.hostname = address.address;
    return urlObj.toString();
  } catch (error) {
    throw new Error(`DNS resolution failed for ${hostname}: ${error.message}`);
  }
};

/**
 * Check if a string is an IP address
 * @param {string} str - String to check
 * @returns {boolean} - True if it's an IP address
 */
const isIPAddress = (str) => {
  // Simple IPv4 regex
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Simple IPv6 regex (basic check)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(str) || ipv6Regex.test(str);
};

/**
 * Get IPv4 addresses for relay hostnames (for diagnostics)
 * @param {string[]} relayUrls - Array of relay URLs
 */
export const diagnoseDNSResolution = async (relayUrls) => {
  console.log("\n🔍 DNS Resolution Diagnostics:");

  for (const url of relayUrls) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      if (isIPAddress(hostname)) {
        console.log(`${hostname} - Already IP address`);
        continue;
      }

      // Test both IPv4 and IPv6 resolution
      try {
        const ipv4 = await dnsLookup(hostname, { family: 4 });
        console.log(`${hostname} -> IPv4: ${ipv4.address}`);
      } catch (error) {
        console.log(`${hostname} -> IPv4: Failed (${error.message})`);
      }

      try {
        const ipv6 = await dnsLookup(hostname, { family: 6 });
        console.log(`${hostname} -> IPv6: ${ipv6.address}`);
      } catch (error) {
        console.log(`${hostname} -> IPv6: Failed (${error.message})`);
      }
    } catch (error) {
      console.log(`Invalid URL ${url}: ${error.message}`);
    }
  }
};
