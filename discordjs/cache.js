const { backend_address } = require('./config.json');


const cache = {};
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

async function getWithCache(key, url) {
    const now = Date.now();
    if (cache[key]?.data && (now - cache[key].timestamp < CACHE_DURATION)) {
        return cache[key].data;
    }

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            const json = await res.json();
            cache[key] = {
                data: json.response,
                timestamp: now,
            };
            return json.response;
        } else {
            console.error(`Fetch error (${key}):`, res.status, res.statusText);
            cache[key] = { data: null, timestamp: now };
            return null;
        }
    } catch (err) {
        console.error(`Erreur fetch ${key}:`, err);
        cache[key] = { data: null, timestamp: now };
        return null;
    }
}
async function getAvailableServices() {
    return getWithCache('services', `${backend_address}/service/get-all`);
}
module.exports = {
    getWithCache,
    getAvailableServices
};
