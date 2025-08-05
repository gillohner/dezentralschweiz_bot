# IPv4/IPv6 Network Fix for Hetzner VPS

This document outlines the comprehensive solution implemented to fix IPv6/IPv4 connectivity issues on Hetzner VPS when publishing Nostr events.

## Problem

Hetzner VPS servers often default to IPv6 for network connections, but many Nostr relays have better IPv4 connectivity, causing connection timeouts and failures when publishing events.

## Solutions Implemented

### 1. Enhanced WebSocket Configuration

- **File**: `utils/nostrUtils.js`
- **Change**: Improved WebSocket factory with robust IPv4 enforcement
- **Features**:
  - Force IPv4 with `family: 4`
  - Extended timeouts (30 seconds)
  - Custom User-Agent header
  - Better error handling

### 2. System-Level IPv4 Preference

- **File**: `.github/workflows/deploy.yml`
- **Change**: Added Node.js DNS preference to deployment
- **Features**:
  - Sets `NODE_OPTIONS="--dns-result-order=ipv4first"`
  - Applies IPv4 preference during PM2 startup

### 3. PM2 Ecosystem Configuration

- **File**: `ecosystem.config.cjs`
- **Change**: Enhanced environment variables and Node.js arguments
- **Features**:
  - Force IPv4 DNS resolution
  - Disable IPv6 where possible
  - Additional network tuning parameters

### 4. Network Diagnostics

- **File**: `utils/networkDiagnostics.js`
- **Features**:
  - Network connectivity testing
  - IPv4/IPv6 status checks
  - Relay-specific connection tests
  - System network information gathering

### 5. IPv4 Relay Resolution

- **File**: `utils/ipv4RelayResolver.js`
- **Features**:
  - Manual DNS resolution to IPv4 addresses
  - Fallback to original URLs if resolution fails
  - Diagnostic DNS resolution testing

### 6. Startup Diagnostics

- **File**: `bot.js`
- **Change**: Added network diagnostics on production startup
- **Features**:
  - Automatic network testing
  - Relay connectivity verification
  - DNS resolution diagnostics

## Environment Variables Required

Add to your `.env` file:

```bash
# Existing variables
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
NADDR_LIST=comma_separated_list_of_event_kinds_31924
DEFAULT_RELAYS=your_post_relays_here
ADMIN_CHAT_ID=your_admin_chat_id_here
BOT_NSEC=your_bot_private_key_here
EVENT_CALENDAR_NADDR=your_event_calendar_naddr_here

# New logging variable
LOGS_CHAT_ID=your_logs_chat_id_here
```

## Manual VPS Configuration (Optional)

If issues persist, you can apply these manual fixes on your Hetzner VPS:

### 1. Disable IPv6 System-Wide

```bash
echo 'net.ipv6.conf.all.disable_ipv6 = 1' >> /etc/sysctl.conf
echo 'net.ipv6.conf.default.disable_ipv6 = 1' >> /etc/sysctl.conf
echo 'net.ipv6.conf.lo.disable_ipv6 = 1' >> /etc/sysctl.conf
sysctl -p
```

### 2. Configure DNS to Prefer IPv4

```bash
echo 'precedence ::ffff:0:0/96 100' >> /etc/gai.conf
```

### 3. Set Node.js IPv4 Preference Globally

```bash
echo 'export NODE_OPTIONS="--dns-result-order=ipv4first"' >> ~/.bashrc
source ~/.bashrc
```

## Testing the Fix

After deployment, monitor the bot logs for:

1. **Startup Diagnostics**: Look for network connectivity tests
2. **Relay Resolution**: Check if IPv4 addresses are being resolved
3. **Connection Success**: Verify successful Nostr event publishing
4. **Error Reduction**: Monitor for fewer connection timeouts

## Monitoring

The enhanced logging system will help track:

- Event creation attempts
- Publishing success/failure rates
- Network connectivity issues
- Performance improvements

## Rollback Plan

If issues occur, you can:

1. Revert the WebSocket factory to the simple version
2. Remove IPv4 resolution logic
3. Use original relay URLs
4. Comment out diagnostic checks

The changes are backward compatible and include fallbacks for all new features.
