// timeFrameUtils.js

const timeFrameMap = {
    'heute': 'Heute',
    'dieseWoche': 'Diese Woche',
    '7Tage': '7 Tage',
    '30Tage': '30 Tage',
    'alle': 'Alle'
};

const getTimeFrameName = (timeFrame) => {
    return timeFrameMap[timeFrame] || 'Unbekannter Zeitraum';
};

const getCallbackData = (timeFrame) => {
    return `meetups_${timeFrame}`;
};

const getTimeFrameFromCallback = (callbackData) => {
    return callbackData.replace('meetups_', '');
};

export {
    getTimeFrameName,
    getCallbackData,
    getTimeFrameFromCallback
};
