import axios from 'axios';

// Function to fetch payment tags from OSM using Overpass API
const fetchOsmPaymentTags = async (osmNodeId) => {
    const query = `
        [out:json];
        node(${osmNodeId});
        out tags;
    `;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    
    try {
        const response = await axios.get(url);
        const tags = response.data.elements[0].tags;
        
        let emojis = '';
        if (tags['payment:lightning'] === 'yes') emojis += '⚡';
        if (tags['payment:lightning_contactless'] === 'yes') emojis += '🛜';
        if (tags['payment:onchain'] === 'yes') emojis += '⛓️';
        
        return emojis;
    } catch (error) {
        console.error('Error fetching OSM data:', error);
        return '';
    }
}

export {
    fetchOsmPaymentTags
}
