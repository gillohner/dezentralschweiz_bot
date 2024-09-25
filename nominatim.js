import fetch from 'node-fetch';

const fetchLocationData = async (query) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Error fetching location data:', error);
        return null;
    }
};

export default fetchLocationData;