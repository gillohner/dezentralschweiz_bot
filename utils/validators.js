// utils/validators.js
export const isValidDate = (dateStr) => /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

export const isValidTime = (timeStr) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
