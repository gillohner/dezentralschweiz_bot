import { fetchCalendarEvents } from './nostrUtils.js';
import { getTimeFrameName, getTimeFrameFromCallback } from '../utils/timeFrameUtils.js'

const sortEventsByStartDate = (eventList) => {
  return eventList.map(calendar => ({
    ...calendar,
    events: calendar.events.sort((a, b) => {
      const aStart = parseInt(a.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000;
      const bStart = parseInt(b.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000;
      return aStart - bStart;
    })
  }));
};

const fetchAndFilterEvents = async (config, timeFrame) => {
  let allEvents = [];
  for (const naddr of config.NADDR_LIST) {
    const result = await fetchCalendarEvents(naddr);
    console.log(result);
    if (result && result.calendarName) {
      allEvents.push(result);
    }
  }
  return sortEventsByStartDate(filterEventsByTimeFrame(allEvents, timeFrame));
};

const fetchAndProcessEvents = async (config, callbackData) => {
  const timeFrame = getTimeFrameFromCallback(callbackData);
  let allEvents = await fetchAndFilterEvents(config, timeFrame);

  if (allEvents.length === 0) {
    return { status: 'empty', message: 'Keine Kalender oder Meetups gefunden.' };
  }

  const filteredEvents = filterEventsByTimeFrame(allEvents, timeFrame);

  if (filteredEvents.every(cal => cal.events.length === 0)) {
    return { 
      status: 'noEvents', 
      message: `Keine Meetups für den gewählten Zeitraum (${getTimeFrameName(timeFrame)}) gefunden.` 
    };
  }

  return { status: 'success', events: filteredEvents };
};

const filterEventsByTimeFrame = (allEvents, timeFrame) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);
  in7Days.setHours(23, 59, 59, 999);

  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  in30Days.setHours(23, 59, 59, 999);

  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  return allEvents.map(calendar => ({
    ...calendar,
    events: calendar.events.filter(event => {
      const eventDate = new Date(parseInt(event.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000);
      switch (timeFrame) {
        case 'heute':
          return eventDate >= today && eventDate <= endOfDay;
        case 'dieseWoche':
          return eventDate >= today && eventDate <= endOfWeek;
        case '7Tage':
          return eventDate >= today && eventDate <= in7Days;
        case '30Tage':
          return eventDate >= today && eventDate <= in30Days;
        default:
          return eventDate >= today;
      }
    })
  }));
};

export {
  fetchAndProcessEvents,
};
