const COOLDOWN_DURATION = 1 * 60 * 1000; // 15 minutes in milliseconds

class Cooldown {
  constructor() {
    this.lastAccess = new Map();
  }

  isOnCooldown(chatId, category) {
    const key = `${chatId}_${category}`;
    const lastAccessTime = this.lastAccess.get(key);
    if (!lastAccessTime) return false;
    return Date.now() - lastAccessTime < COOLDOWN_DURATION;
  }

  setCooldown(chatId, category) {
    const key = `${chatId}_${category}`;
    this.lastAccess.set(key, Date.now());
  }
}

export default new Cooldown();
