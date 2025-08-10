// Utility function to convert date formats for different international users
// This function can be extended to handle various international date formats

export const parseInternationalDateTime = (input, userLocale = 'de-CH') => {
  // Remove extra spaces and normalize
  const cleanInput = input.trim().replace(/\s+/g, ' ');
  
  // Define patterns for different locales
  const localePatterns = {
    'de-CH': [
      /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2})\s+(\d{1,2}):(\d{2})$/,     // DD.MM.YY HH:MM
      /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})\s+(\d{1,2}):(\d{2})$/,     // DD.MM.YYYY HH:MM
    ],
    'en-US': [
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/,               // MM/DD/YY HH:MM
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/,               // MM/DD/YYYY HH:MM
    ],
    'en-GB': [
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/,               // DD/MM/YY HH:MM
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/,               // DD/MM/YYYY HH:MM
    ],
    'iso': [
      /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/,                 // YYYY-MM-DD HH:MM
    ]
  };

  const patterns = localePatterns[userLocale] || localePatterns['de-CH'];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      let day, month, year, hours, minutes;
      
      if (userLocale === 'en-US') {
        // US format: MM/DD/YY or MM/DD/YYYY
        [, month, day, year, hours, minutes] = match;
      } else if (userLocale === 'iso') {
        // ISO format: YYYY-MM-DD HH:MM
        [, year, month, day, hours, minutes] = match;
      } else {
        // Default European format: DD.MM.YY or DD/MM/YY
        [, day, month, year, hours, minutes] = match;
      }
      
      // Parse numbers
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      let yearNum = parseInt(year);
      const hoursNum = parseInt(hours);
      const minutesNum = parseInt(minutes);
      
      // Convert 2-digit year to 4-digit
      if (yearNum < 100) {
        yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
      }
      
      // Validate ranges
      if (dayNum < 1 || dayNum > 31 || 
          monthNum < 1 || monthNum > 12 || 
          yearNum < 2020 || yearNum > 2100 ||
          hoursNum < 0 || hoursNum > 23 || 
          minutesNum < 0 || minutesNum > 59) {
        continue; // Try next pattern
      }
      
      // Create date object and validate it's a real date
      const date = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum);
      if (date.getFullYear() !== yearNum || 
          date.getMonth() !== monthNum - 1 || 
          date.getDate() !== dayNum ||
          date.getHours() !== hoursNum ||
          date.getMinutes() !== minutesNum) {
        continue; // Try next pattern
      }
      
      // Check if date is in the future (allow events from 1 hour ago to account for timezone differences)
      const now = new Date();
      now.setHours(now.getHours() - 1);
      if (date <= now) {
        return { isValid: false, error: 'past_date' };
      }
      
      return {
        isValid: true,
        dateString: `${dayNum.toString().padStart(2, '0')}.${monthNum.toString().padStart(2, '0')}.${yearNum}`,
        timeString: `${hoursNum.toString().padStart(2, '0')}:${minutesNum.toString().padStart(2, '0')}`,
        isoDateString: `${yearNum}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`,
        timestamp: Math.floor(date.getTime() / 1000),
        date: date,
        locale: userLocale
      };
    }
  }
  
  return { isValid: false };
};

// Function to detect user's likely date format preference based on their input or locale
export const detectDateFormatPreference = (telegramUser) => {
  // In the future, we could detect based on:
  // - User's Telegram language setting
  // - Previous successful date inputs
  // - Geographic location
  
  // For now, default to Swiss/German format
  return 'de-CH';
};