import { fetchCalendarEvents } from './nostrUtils.js';

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

const filterEventsByTimeFrame = (allEvents, timeFrame) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);
  const inOneMonth = new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000);

  return allEvents.map(calendar => ({
    ...calendar,
    events: calendar.events.filter(event => {
      const eventDate = new Date(parseInt(event.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000);
      switch (timeFrame) {
        case 'today':
          return eventDate >= today && eventDate <= endOfDay;
        case 'week':
          return eventDate >= today && eventDate <= endOfWeek;
        case 'month':
          return eventDate >= today && eventDate <= inOneMonth;
        default:
          return eventDate >= today;
      }
    })
  }));
};

export {
  fetchAndFilterEvents,
  filterEventsByTimeFrame
};
