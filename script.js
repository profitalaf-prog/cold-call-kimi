/**
 * Cold Call Finder — Main Application Script
 * Pure vanilla JavaScript, no frameworks, no dependencies.
 * Supports both Google Places API (New) and FREE OpenStreetMap Overpass API.
 */

// ============================================
// Configuration
// ============================================
const PASSWORD = '26.Af.10';
const STORAGE_KEY = 'coldcallfinder_data';
const STORAGE_AUTH = 'coldcallfinder_auth';

// OpenStreetMap Overpass API endpoints (free, no key needed)
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_BACKUP = 'https://overpass.kumi.systems/api/interpreter';

// ============================================
// State
// ============================================
let leads = [];
let userLocation = null;
let locationName = '';
let isSearching = false;
let searchProvider = 'osm'; // 'osm' or 'google'

// ============================================
// DOM References
// ============================================
const $ = (id) => document.getElementById(id);

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initLocation();
    bindEvents();
    loadData();
    initProviderToggle();
});

// ============================================
// Search Provider Toggle (Google vs OpenStreetMap)
// ============================================
function initProviderToggle() {
    const saved = localStorage.getItem('coldcallfinder_provider');
    if (saved) searchProvider = saved;
    updateProviderUI();
}

function setProvider(provider) {
    searchProvider = provider;
    localStorage.setItem('coldcallfinder_provider', provider);
    updateProviderUI();
}

function updateProviderUI() {
    const googleBtn = $('providerGoogle');
    const osmBtn = $('providerOsm');
    if (!googleBtn || !osmBtn) return;

    if (searchProvider === 'google') {
        googleBtn.classList.add('active');
        osmBtn.classList.remove('active');
        $('apiKeyBox').style.display = '';
    } else {
        googleBtn.classList.remove('active');
        osmBtn.classList.add('active');
        $('apiKeyBox').style.display = 'none';
    }
}

// ============================================
// Authentication
// ============================================
function initAuth() {
    const isAuthed = localStorage.getItem(STORAGE_AUTH) === 'true';
    if (isAuthed) {
        showApp();
    } else {
        showLogin();
    }
}

function showLogin() {
    $('loginScreen').style.display = 'flex';
    $('appScreen').style.display = 'none';
    $('passwordInput').focus();
}

function showApp() {
    $('loginScreen').style.display = 'none';
    $('appScreen').style.display = 'block';
    renderDashboard();
    renderTable();
}

function attemptLogin() {
    const input = $('passwordInput').value.trim();
    if (input === PASSWORD) {
        localStorage.setItem(STORAGE_AUTH, 'true');
        $('loginError').textContent = '';
        showApp();
    } else {
        $('loginError').textContent = 'Incorrect password.';
        $('passwordInput').value = '';
        $('passwordInput').focus();
    }
}

function logout() {
    localStorage.removeItem(STORAGE_AUTH);
    showLogin();
    $('passwordInput').value = '';
}

// ============================================
// Geolocation
// ============================================
function initLocation() {
    if (!navigator.geolocation) {
        $('locationStatus').textContent = 'Geolocation not supported. Use manual location.';
        $('manualLocationBox').style.display = 'flex';
        return;
    }

    $('locationStatus').textContent = 'Detecting your location...';

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLocation = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            };
            $('locationStatus').textContent = 'Location detected. Ready to search.';
            reverseGeocode(userLocation.lat, userLocation.lng);
        },
        (err) => {
            console.warn('Geolocation error:', err);
            $('locationStatus').textContent = 'Location access denied. Use manual location.';
            $('manualLocationBox').style.display = 'flex';
        },
        { timeout: 10000, maximumAge: 60000 }
    );
}

function reverseGeocode(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'Accept-Language': 'en' }
    })
    .then(r => r.json())
    .then(data => {
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
            const country = data.address.country || '';
            locationName = city + (city && country ? ', ' : '') + country;
            if (locationName) {
                $('locationStatus').textContent = `Location: ${locationName}`;
            }
        }
    })
    .catch(() => {});
}

function setManualLocation() {
    const query = $('manualLocationInput').value.trim();
    if (!query) return;

    $('locationStatus').textContent = 'Looking up location...';

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en' }
    })
    .then(r => r.json())
    .then(data => {
        if (data && data.length > 0) {
            const result = data[0];
            userLocation = {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon)
            };
            locationName = result.display_name.split(',')[0];
            $('locationStatus').textContent = `Location: ${locationName}`;
            $('manualLocationBox').style.display = 'none';
        } else {
            $('locationStatus').textContent = 'Location not found. Try again.';
        }
    })
    .catch(() => {
        $('locationStatus').textContent = 'Error looking up location. Try again.';
    });
}

// ============================================
// Event Bindings
// ============================================
function bindEvents() {
    // Login
    $('loginBtn').addEventListener('click', attemptLogin);
    $('passwordInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });
    $('logoutBtn').addEventListener('click', logout);

    // Location
    $('manualLocationBtn').addEventListener('click', () => {
        const box = $('manualLocationBox');
        box.style.display = box.style.display === 'none' ? 'flex' : 'none';
        if (box.style.display !== 'none') $('manualLocationInput').focus();
    });
    $('setLocationBtn').addEventListener('click', setManualLocation);
    $('manualLocationInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') setManualLocation();
    });

    // Search
    $('searchBtn').addEventListener('click', performSearch);
    $('nicheInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Provider toggle
    $('providerGoogle').addEventListener('click', () => setProvider('google'));
    $('providerOsm').addEventListener('click', () => setProvider('osm'));

    // API key
    $('saveApiKeyBtn').addEventListener('click', saveApiKey);
    $('apiKeyInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveApiKey();
    });

    // Filter
    $('filterInput').addEventListener('input', () => {
        renderTable();
    });

    // Export
    $('exportBtn').addEventListener('click', exportCSV);

    // Clear
    $('clearBtn').addEventListener('click', () => {
        if (confirm('Clear all leads? This cannot be undone.')) {
            leads = [];
            saveData();
            renderDashboard();
            renderTable();
        }
    });
}

function saveApiKey() {
    const key = $('apiKeyInput').value.trim();
    if (key) {
        localStorage.setItem('coldcallfinder_apikey', key);
        $('apiKeyInput').value = '';
        showAlert('API key saved.', 'info');
    }
}

// ============================================
// Search — Main Entry Point
// ============================================
async function performSearch() {
    const niche = $('nicheInput').value.trim();
    if (!niche) {
        showAlert('Please enter a business niche.', 'warn');
        return;
    }

    if (!userLocation) {
        showAlert('Location not set. Allow geolocation or enter a city manually.', 'warn');
        $('manualLocationBox').style.display = 'flex';
        return;
    }

    if (searchProvider === 'google') {
        await searchGoogle(niche);
    } else {
        await searchOpenStreetMap(niche);
    }
}

// ============================================
// Google Places API Search
// ============================================
async function searchGoogle(niche) {
    const apiKey = localStorage.getItem('coldcallfinder_apikey');
    if (!apiKey) {
        showAlert('Google Places API key required. Enter it below or switch to OpenStreetMap (free).', 'warn');
        $('apiKeyBox').style.display = '';
        $('apiKeyInput').focus();
        return;
    }

    const radius = parseInt($('radiusSelect').value, 10);
    setSearching(true);
    clearAlert();

    try {
        const searchBody = {
            textQuery: niche,
            locationBias: {
                circle: {
                    center: { latitude: userLocation.lat, longitude: userLocation.lng },
                    radius: radius
                }
            },
            pageSize: 20
        };

        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus,places.location'
            },
            body: JSON.stringify(searchBody)
        });

        if (!searchRes.ok) {
            const errData = await searchRes.json().catch(() => ({}));
            const msg = errData.error?.message || `HTTP ${searchRes.status}`;
            if (searchRes.status === 403 || searchRes.status === 401) {
                localStorage.removeItem('coldcallfinder_apikey');
                throw new Error('Invalid API key. Please check your Google Cloud Console or switch to OpenStreetMap (free).');
            }
            throw new Error(msg);
        }

        const searchData = await searchRes.json();
        const places = searchData.places || [];

        if (places.length === 0) {
            showAlert('No businesses found. Try a different niche or expand the radius.', 'info');
            setSearching(false);
            return;
        }

        processResults(places, 'google');
    } catch (err) {
        console.error('Google search error:', err);
        showAlert(err.message || 'Search failed. Try switching to OpenStreetMap.', 'error');
    } finally {
        setSearching(false);
    }
}

// ============================================
// OpenStreetMap Overpass API Search (FREE)
// ============================================
async function searchOpenStreetMap(niche) {
    const radius = parseInt($('radiusSelect').value, 10);
    setSearching(true);
    clearAlert();

    // Map common business niches to OSM tags
    const osmTagMap = {
        'restaurant': ['amenity=restaurant', 'amenity=fast_food'],
        'restaurants': ['amenity=restaurant', 'amenity=fast_food'],
        'cafe': ['amenity=cafe'],
        'cafes': ['amenity=cafe'],
        'bar': ['amenity=bar', 'amenity=pub'],
        'bars': ['amenity=bar', 'amenity=pub'],
        'pub': ['amenity=pub'],
        'hotel': ['tourism=hotel', 'tourism=motel'],
        'hotels': ['tourism=hotel', 'tourism=motel'],
        'dentist': ['amenity=dentist'],
        'dentists': ['amenity=dentist'],
        'doctor': ['amenity=doctors'],
        'doctors': ['amenity=doctors'],
        'clinic': ['amenity=clinic'],
        'clinics': ['amenity=clinic'],
        'hospital': ['amenity=hospital'],
        'pharmacy': ['amenity=pharmacy'],
        'pharmacies': ['amenity=pharmacy'],
        'hair': ['shop=hairdresser'],
        'hairdresser': ['shop=hairdresser'],
        'hair salon': ['shop=hairdresser'],
        'salon': ['shop=hairdresser', 'shop=beauty'],
        'beauty': ['shop=beauty'],
        'gym': ['leisure=fitness_centre', 'leisure=sports_centre'],
        'gyms': ['leisure=fitness_centre', 'leisure=sports_centre'],
        'fitness': ['leisure=fitness_centre'],
        'plumber': ['craft=plumber'],
        'plumbers': ['craft=plumber'],
        'electrician': ['craft=electrician'],
        'electricians': ['craft=electrician'],
        'roofer': ['craft=roofer'],
        'roofers': ['craft=roofer'],
        'carpenter': ['craft=carpenter'],
        'carpenters': ['craft=carpenter'],
        'mechanic': ['shop=car_repair'],
        'mechanics': ['shop=car_repair'],
        'car repair': ['shop=car_repair'],
        'lawyer': ['office=lawyer'],
        'lawyers': ['office=lawyer'],
        'attorney': ['office=lawyer'],
        'attorneys': ['office=lawyer'],
        'accountant': ['office=accountant'],
        'accountants': ['office=accountant'],
        'real estate': ['office=estate_agent'],
        'realtor': ['office=estate_agent'],
        'realtors': ['office=estate_agent'],
        'estate agent': ['office=estate_agent'],
        'insurance': ['office=insurance'],
        'bank': ['amenity=bank'],
        'banks': ['amenity=bank'],
        'supermarket': ['shop=supermarket'],
        'supermarkets': ['shop=supermarket'],
        'bakery': ['shop=bakery'],
        'bakeries': ['shop=bakery'],
        'butcher': ['shop=butcher'],
        'butchers': ['shop=butcher'],
        'florist': ['shop=florist'],
        'florists': ['shop=florist'],
        'optician': ['shop=optician'],
        'opticians': ['shop=optician'],
        'shoe': ['shop=shoes'],
        'shoes': ['shop=shoes'],
        'clothes': ['shop=clothes'],
        'clothing': ['shop=clothes'],
        'pet': ['shop=pet'],
        'pets': ['shop=pet'],
        'vet': ['amenity=veterinary'],
        'veterinary': ['amenity=veterinary'],
        'veterinarian': ['amenity=veterinary'],
        'tattoo': ['shop=tattoo'],
        'tattoos': ['shop=tattoo'],
        'piercing': ['shop=piercing'],
        'laundry': ['shop=laundry'],
        'dry cleaning': ['shop=dry_cleaning'],
        'tailor': ['shop=tailor'],
        'tailors': ['shop=tailor'],
        'jewelry': ['shop=jewelry'],
        'jeweller': ['shop=jewelry'],
        'jewellers': ['shop=jewelry'],
        'watch': ['shop=watches'],
        'watches': ['shop=watches'],
        'electronics': ['shop=electronics'],
        'phone': ['shop=mobile_phone'],
        'phones': ['shop=mobile_phone'],
        'computer': ['shop=computer'],
        'computers': ['shop=computer'],
        'bookstore': ['shop=books'],
        'bookstores': ['shop=books'],
        'books': ['shop=books'],
        'toy': ['shop=toys'],
        'toys': ['shop=toys'],
        'furniture': ['shop=furniture'],
        'garden': ['shop=garden_centre'],
        'garden centre': ['shop=garden_centre'],
        'hardware': ['shop=hardware'],
        'paint': ['shop=paint'],
        'stationery': ['shop=stationery'],
        'photo': ['shop=photo'],
        'photography': ['shop=photo'],
        'copy': ['shop=copyshop'],
        'copyshop': ['shop=copyshop'],
        'travel': ['shop=travel_agency'],
        'travel agency': ['shop=travel_agency'],
        'gas': ['amenity=fuel'],
        'fuel': ['amenity=fuel'],
        'gas station': ['amenity=fuel'],
        'charging': ['amenity=charging_station'],
        'charging station': ['amenity=charging_station'],
        'car wash': ['amenity=car_wash'],
        'parking': ['amenity=parking'],
        'taxi': ['amenity=taxi'],
        'taxis': ['amenity=taxi'],
        'bus': ['amenity=bus_station'],
        'bus station': ['amenity=bus_station'],
        'train': ['amenity=train_station'],
        'train station': ['amenity=train_station'],
        'post': ['amenity=post_office'],
        'post office': ['amenity=post_office'],
        'library': ['amenity=library'],
        'libraries': ['amenity=library'],
        'museum': ['tourism=museum'],
        'museums': ['tourism=museum'],
        'cinema': ['amenity=cinema'],
        'cinemas': ['amenity=cinema'],
        'theatre': ['amenity=theatre'],
        'theater': ['amenity=theatre'],
        'theatres': ['amenity=theatre'],
        'theaters': ['amenity=theatre'],
        'art': ['tourism=gallery'],
        'gallery': ['tourism=gallery'],
        'galleries': ['tourism=gallery'],
        'zoo': ['tourism=zoo'],
        'zoos': ['tourism=zoo'],
        'aquarium': ['tourism=aquarium'],
        'aquariums': ['tourism=aquarium'],
        'amusement': ['tourism=theme_park'],
        'theme park': ['tourism=theme_park'],
        'camp': ['tourism=camp_site'],
        'campsite': ['tourism=camp_site'],
        'camping': ['tourism=camp_site'],
        'hostel': ['tourism=hostel'],
        'hostels': ['tourism=hostel'],
        'guest': ['tourism=guest_house'],
        'guest house': ['tourism=guest_house'],
        'bed and breakfast': ['tourism=guest_house'],
        'bnb': ['tourism=guest_house'],
        'spa': ['leisure=spa'],
        'sauna': ['leisure=sauna'],
        'massage': ['shop=massage'],
        'yoga': ['leisure=yoga'],
        'dance': ['leisure=dance'],
        'bowling': ['leisure=bowling_alley'],
        'skating': ['leisure=ice_rink'],
        'ice rink': ['leisure=ice_rink'],
        'swimming': ['leisure=swimming_pool'],
        'pool': ['leisure=swimming_pool'],
        'sports': ['leisure=sports_centre'],
        'stadium': ['leisure=stadium'],
        'stadiums': ['leisure=stadium'],
        'track': ['leisure=track'],
        'pitch': ['leisure=pitch'],
        'golf': ['leisure=golf_course'],
        'golf course': ['leisure=golf_course'],
        'mini golf': ['leisure=miniature_golf'],
        'casino': ['amenity=casino'],
        'casinos': ['amenity=casino'],
        'nightclub': ['amenity=nightclub'],
        'nightclubs': ['amenity=nightclub'],
        'strip club': ['amenity=stripclub'],
        'adult': ['shop=erotic'],
        'erotic': ['shop=erotic'],
        'sex': ['shop=erotic'],
        'cannabis': ['shop=cannabis'],
        'tobacco': ['shop=tobacco'],
        'alcohol': ['shop=alcohol'],
        'wine': ['shop=wine'],
        'liquor': ['shop=alcohol'],
        'convenience': ['shop=convenience'],
        'convenience store': ['shop=convenience'],
        'kiosk': ['shop=kiosk'],
        'newsagent': ['shop=newsagent'],
        'tobacconist': ['shop=tobacco'],
        'lottery': ['shop=lottery'],
        'ticket': ['shop=ticket'],
        'tickets': ['shop=ticket'],
        'money': ['amenity=bureau_de_change'],
        'exchange': ['amenity=bureau_de_change'],
        'atm': ['amenity=atm'],
        'vending': ['amenity=vending_machine'],
        'recycling': ['amenity=recycling'],
        'waste': ['amenity=waste_disposal'],
        'toilets': ['amenity=toilets'],
        'shower': ['amenity=shower'],
        'drinking': ['amenity=drinking_water'],
        'water': ['amenity=drinking_water'],
        'bench': ['amenity=bench'],
        'shelter': ['amenity=shelter'],
        'telephone': ['amenity=telephone'],
        'clock': ['amenity=clock'],
        'fire': ['amenity=fire_station'],
        'fire station': ['amenity=fire_station'],
        'police': ['amenity=police'],
        'ambulance': ['emergency=ambulance_station'],
        'defibrillator': ['emergency=defibrillator'],
        'mountain rescue': ['emergency=mountain_rescue'],
        'lifeboat': ['emergency=lifeboat_station'],
    };

    // Normalize niche input
    const nicheLower = niche.toLowerCase().trim();
    let tags = osmTagMap[nicheLower];

    // If no exact match, try partial matching
    if (!tags) {
        for (const [key, val] of Object.entries(osmTagMap)) {
            if (nicheLower.includes(key) || key.includes(nicheLower)) {
                tags = val;
                break;
            }
        }
    }

    // Fallback: search by name containing the niche word
    if (!tags) {
        tags = [`name~"${niche}"`];
    }

    // Build Overpass QL query
    const lat = userLocation.lat;
    const lon = userLocation.lng;
    const r = radius;

    // Build tag filters
    const tagFilters = tags.map(t => {
        if (t.includes('=')) {
            const [k, v] = t.split('=');
            return `["${k}"="${v}"]`;
        }
        return t;
    }).join('');

    // Overpass QL: search nodes, ways, relations around a point with radius
    const query = `
[out:json][timeout:60];
(
  node${tagFilters}(around:${r},${lat},${lon})["phone"];
  way${tagFilters}(around:${r},${lat},${lon})["phone"];
  relation${tagFilters}(around:${r},${lat},${lon})["phone"];
);
out body center;
>;
out skel qt;
`;

    try {
        let res = await fetch(OVERPASS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query)
        });

        if (!res.ok) {
            res = await fetch(OVERPASS_BACKUP, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'data=' + encodeURIComponent(query)
            });
        }

        if (!res.ok) {
            throw new Error(`Overpass API error: ${res.status}`);
        }

        const data = await res.json();
        const elements = data.elements || [];

        // Also try a broader search without requiring phone in the query
        const query2 = `
[out:json][timeout:60];
(
  node${tagFilters}(around:${r},${lat},${lon});
  way${tagFilters}(around:${r},${lat},${lon});
  relation${tagFilters}(around:${r},${lat},${lon});
);
out body center;
>;
out skel qt;
`;

        const res2 = await fetch(OVERPASS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query2)
        });

        let allElements = [...elements];
        if (res2.ok) {
            const data2 = await res2.json();
            const elements2 = data2.elements || [];
            const seenIds = new Set(allElements.map(e => e.type + e.id));
            for (const el of elements2) {
                const key = el.type + el.id;
                if (!seenIds.has(key)) {
                    seenIds.add(key);
                    allElements.push(el);
                }
            }
        }

        if (allElements.length === 0) {
            showAlert('No businesses found in OpenStreetMap for this area. Try a different niche, larger radius, or switch to Google Places.', 'info');
            setSearching(false);
            return;
        }

        processOsmResults(allElements, niche);
    } catch (err) {
        console.error('OSM search error:', err);
        showAlert(err.message || 'OpenStreetMap search failed. Try again or switch to Google Places.', 'error');
    } finally {
        setSearching(false);
    }
}

function processOsmResults(elements, niche) {
    let added = 0;
    const existingIds = new Set(leads.map(l => l.id));
    const existingPhones = new Set(leads.map(l => normalizePhone(l.phone)));

    for (const el of elements) {
        const tags = el.tags || {};
        const phone = tags.phone || tags['contact:phone'] || tags.telephone || '';
        if (!phone) continue;

        const normPhone = normalizePhone(phone);
        if (existingPhones.has(normPhone)) continue;

        const id = `osm-${el.type}-${el.id}`;
        if (existingIds.has(id)) continue;

        // Get coordinates
        let lat, lon;
        if (el.lat && el.lon) {
            lat = el.lat;
            lon = el.lon;
        } else if (el.center) {
            lat = el.center.lat;
            lon = el.center.lon;
        } else if (el.bounds) {
            lat = (el.bounds.minlat + el.bounds.maxlat) / 2;
            lon = (el.bounds.minlon + el.bounds.maxlon) / 2;
        } else {
            continue;
        }

        // Build address from OSM tags
        const addressParts = [];
        if (tags['addr:street']) {
            let street = tags['addr:street'];
            if (tags['addr:housenumber']) street += ' ' + tags['addr:housenumber'];
            addressParts.push(street);
        }
        if (tags['addr:postcode']) addressParts.push(tags['addr:postcode']);
        if (tags['addr:city']) addressParts.push(tags['addr:city']);
        if (tags['addr:country']) addressParts.push(tags['addr:country']);

        const address = addressParts.join(', ') || '';

        // Determine category from OSM tags
        let category = niche;
        if (tags.amenity) category = tags.amenity;
        else if (tags.shop) category = tags.shop;
        else if (tags.tourism) category = tags.tourism;
        else if (tags.leisure) category = tags.leisure;
        else if (tags.craft) category = tags.craft;
        else if (tags.office) category = tags.office;
        else if (tags.healthcare) category = tags.healthcare;

        category = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const lead = {
            id: id,
            name: tags.name || tags['name:en'] || 'Unnamed ' + category,
            phone: phone,
            address: address,
            website: tags.website || tags['contact:website'] || tags['contact:url'] || '',
            mapsLink: `https://www.openstreetmap.org/${el.type}/${el.id}`,
            rating: null,
            reviews: 0,
            category: category,
            status: 'tocall',
            notes: '',
            lastContact: '',
            called: false,
            createdAt: Date.now(),
            source: 'osm',
            lat: lat,
            lon: lon
        };

        leads.push(lead);
        existingIds.add(id);
        existingPhones.add(normPhone);
        added++;
    }

    if (added === 0) {
        showAlert(`${elements.length} places found in OSM, but none had a phone number. Try a different area or niche.`, 'warn');
    } else {
        showAlert(`Found ${added} new lead${added !== 1 ? 's' : ''} via OpenStreetMap (free).`, 'info');
    }

    saveData();
    renderDashboard();
    renderTable();
}

function normalizePhone(phone) {
    return String(phone).replace(/\D/g, '').replace(/^0+/, '');
}

// ============================================
// Process Google Results
// ============================================
function processResults(places, source) {
    let added = 0;
    const existingIds = new Set(leads.map(l => l.id));
    const existingPhones = new Set(leads.map(l => normalizePhone(l.phone)));

    for (const place of places) {
        const phone = place.internationalPhoneNumber || '';
        if (!phone) continue;

        const normPhone = normalizePhone(phone);
        if (existingPhones.has(normPhone)) continue;

        const id = place.id || `${place.displayName?.text || ''}-${place.formattedAddress || ''}`;
        if (existingIds.has(id)) continue;

        const lead = {
            id: id,
            name: place.displayName?.text || 'Unknown',
            phone: phone,
            address: place.formattedAddress || '',
            website: place.websiteUri || '',
            mapsLink: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.location?.latitude || 0)},${encodeURIComponent(place.location?.longitude || 0)}`,
            rating: place.rating || null,
            reviews: place.userRatingCount || 0,
            category: place.primaryTypeDisplayName?.text || '',
            status: 'tocall',
            notes: '',
            lastContact: '',
            called: false,
            createdAt: Date.now(),
            source: source
        };

        leads.push(lead);
        existingIds.add(id);
        existingPhones.add(normPhone);
        added++;
    }

    if (added === 0 && places.length > 0) {
        showAlert(`${places.length} places found, but none had a phone number. Try a different niche.`, 'warn');
    } else {
        showAlert(`Found ${added} new lead${added !== 1 ? 's' : ''}.`, 'info');
    }

    saveData();
    renderDashboard();
    renderTable();
}

// ============================================
// UI Helpers
// ============================================
function setSearching(active) {
    isSearching = active;
    const btn = $('searchBtn');
    const text = $('searchBtnText');
    if (active) {
        btn.disabled = true;
        text.innerHTML = '<span class="spinner"></span>Searching...';
    } else {
        btn.disabled = false;
        text.textContent = 'Search';
    }
}

// ============================================
// Rendering
// ============================================
function renderDashboard() {
    const counts = {
        total: leads.length,
        tocall: 0,
        called: 0,
        accepted: 0,
        rejected: 0,
        progress: 0
    };

    for (const lead of leads) {
        const st = lead.status || 'tocall';
        if (counts[st] !== undefined) counts[st]++;
    }

    $('dashTotal').textContent = counts.total;
    $('dashToCall').textContent = counts.tocall;
    $('dashCalled').textContent = counts.called;
    $('dashAccepted').textContent = counts.accepted;
    $('dashRejected').textContent = counts.rejected;
    $('dashProgress').textContent = counts.progress;
}

function renderTable() {
    const wrap = $('resultsTableWrap');
    const filter = ($('filterInput').value || '').toLowerCase().trim();

    if (leads.length === 0) {
        wrap.innerHTML = `
            <div class="empty-state">
                <p>Enter a business niche and click Search to find leads near you.</p>
                <p style="margin-top:8px;color:var(--text-dim);font-size:12px">
                    Tip: Switch to OpenStreetMap (free) — no API key needed.
                </p>
            </div>
        `;
        return;
    }

    let visible = leads;
    if (filter) {
        visible = leads.filter(l =>
            (l.name || '').toLowerCase().includes(filter) ||
            (l.phone || '').toLowerCase().includes(filter) ||
            (l.address || '').toLowerCase().includes(filter) ||
            (l.category || '').toLowerCase().includes(filter) ||
            (l.notes || '').toLowerCase().includes(filter)
        );
    }

    if (visible.length === 0) {
        wrap.innerHTML = `
            <div class="empty-state">
                <p>No leads match your search filter.</p>
            </div>
        `;
        return;
    }

    const statusOrder = { tocall: 0, called: 1, progress: 2, accepted: 3, rejected: 4 };
    visible = [...visible].sort((a, b) => {
        const oa = statusOrder[a.status] ?? 99;
        const ob = statusOrder[b.status] ?? 99;
        if (oa !== ob) return oa - ob;
        return (a.name || '').localeCompare(b.name || '');
    });

    const statusOptions = [
        { value: 'tocall', label: '\u2610 To Call' },
        { value: 'called', label: '\uD83D\uDCDE Called' },
        { value: 'rejected', label: '\u274C Rejected' },
        { value: 'accepted', label: '\u2705 Accepted' },
        { value: 'progress', label: '\uD83D\uDFE1 In Progress' }
    ];

    let html = '<table><thead><tr>';
    html += '<th class="td-check"><input type="checkbox" id="selectAll" title="Select all"></th>';
    html += '<th>Status</th>';
    html += '<th>Business</th>';
    html += '<th>Phone</th>';
    html += '<th>Address</th>';
    html += '<th>Website</th>';
    html += '<th>Maps</th>';
    html += '<th>Rating</th>';
    html += '<th>Reviews</th>';
    html += '<th>Notes</th>';
    html += '<th>Last Contact</th>';
    html += '<th></th>';
    html += '</tr></thead><tbody>';

    for (const lead of visible) {
        const statusClass = `status-${lead.status || 'tocall'}`;
        const ratingStars = lead.rating ? renderStars(lead.rating) : '—';
        const websiteLink = lead.website
            ? `<a href="${escAttr(lead.website)}" target="_blank" rel="noopener" class="website-link">${esc(shortUrl(lead.website))}</a>`
            : '—';
        const mapsLink = lead.mapsLink
            ? `<a href="${escAttr(lead.mapsLink)}" target="_blank" rel="noopener" class="maps-link" title="Open map">\uD83D\uDCCD</a>`
            : '—';

        const sourceBadge = lead.source === 'osm'
            ? '<span style="font-size:10px;color:var(--text-dim);margin-left:4px">[OSM]</span>'
            : '';

        const statusSelect = `<select class="status-select" data-id="${escAttr(lead.id)}">` +
            statusOptions.map(o => `<option value="${o.value}"${lead.status === o.value ? ' selected' : ''}>${o.label}</option>`).join('') +
            `</select>`;

        html += `<tr class="${statusClass}">`;
        html += `<td class="td-check"><input type="checkbox" class="lead-check" data-id="${escAttr(lead.id)}"${lead.called ? ' checked' : ''}></td>`;
        html += `<td>${statusSelect}</td>`;
        html += `<td><strong>${esc(lead.name)}</strong>${sourceBadge}<br><span style="color:var(--text-muted);font-size:11px">${esc(lead.category || '')}</span></td>`;
        html += `<td><a href="tel:${escAttr(lead.phone)}" class="phone-link">${esc(lead.phone)}</a></td>`;
        html += `<td>${esc(lead.address || '')}</td>`;
        html += `<td>${websiteLink}</td>`;
        html += `<td>${mapsLink}</td>`;
        html += `<td class="rating-cell">${ratingStars}</td>`;
        html += `<td>${lead.reviews || 0}</td>`;
        html += `<td><input type="text" class="note-input" data-id="${escAttr(lead.id)}" value="${escAttr(lead.notes || '')}" placeholder="Add notes..."></td>`;
        html += `<td><input type="date" class="contact-date" data-id="${escAttr(lead.id)}" value="${escAttr(lead.lastContact || '')}"></td>`;
        html += `<td><button class="del-btn" data-id="${escAttr(lead.id)}" title="Delete">\u00D7</button></td>`;
        html += '</tr>';
    }

    html += '</tbody></table>';
    wrap.innerHTML = html;

    attachTableListeners();
}

function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    let stars = '';
    for (let i = 0; i < full; i++) stars += '\u2605';
    if (half) stars += '\u00BD';
    for (let i = 0; i < empty; i++) stars += '\u2606';
    return `<span class="rating-stars">${stars}</span><span class="rating-num">${rating.toFixed(1)}</span>`;
}

function attachTableListeners() {
    document.querySelectorAll('.status-select').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) {
                lead.status = e.target.value;
                if (e.target.value === 'called') lead.called = true;
                saveData();
                renderDashboard();
                renderTable();
            }
        });
    });

    document.querySelectorAll('.lead-check').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) {
                lead.called = e.target.checked;
                if (lead.called && lead.status === 'tocall') {
                    lead.status = 'called';
                } else if (!lead.called && lead.status === 'called') {
                    lead.status = 'tocall';
                }
                saveData();
                renderDashboard();
                renderTable();
            }
        });
    });

    document.querySelectorAll('.note-input').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) {
                lead.notes = e.target.value;
                saveData();
            }
        });
    });

    document.querySelectorAll('.contact-date').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead) {
                lead.lastContact = e.target.value;
                saveData();
            }
        });
    });

    document.querySelectorAll('.del-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const lead = leads.find(l => l.id === id);
            if (lead && confirm(`Delete "${lead.name}"?`)) {
                leads = leads.filter(l => l.id !== id);
                saveData();
                renderDashboard();
                renderTable();
            }
        });
    });

    const selectAll = $('selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            const checked = e.target.checked;
            document.querySelectorAll('.lead-check').forEach(cb => {
                cb.checked = checked;
                const id = cb.dataset.id;
                const lead = leads.find(l => l.id === id);
                if (lead) {
                    lead.called = checked;
                    if (checked && lead.status === 'tocall') lead.status = 'called';
                    else if (!checked && lead.status === 'called') lead.status = 'tocall';
                }
            });
            saveData();
            renderDashboard();
            renderTable();
        });
    }
}

// ============================================
// CSV Export
// ============================================
function exportCSV() {
    if (leads.length === 0) {
        showAlert('No leads to export.', 'warn');
        return;
    }

    const headers = ['Status', 'Business Name', 'Phone', 'Address', 'Website', 'Map Link', 'Rating', 'Reviews', 'Category', 'Notes', 'Last Contact', 'Called', 'Source'];
    const statusLabels = {
        tocall: 'To Call',
        called: 'Called',
        rejected: 'Rejected',
        accepted: 'Accepted',
        progress: 'In Progress'
    };

    const rows = leads.map(l => [
        statusLabels[l.status] || l.status,
        l.name,
        l.phone,
        l.address,
        l.website,
        l.mapsLink,
        l.rating ?? '',
        l.reviews,
        l.category,
        l.notes,
        l.lastContact,
        l.called ? 'Yes' : 'No',
        l.source || 'google'
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => {
            const str = String(cell ?? '').replace(/"/g, '""');
            return /[",\n]/.test(str) ? `"${str}"` : str;
        }).join(','))
        .join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cold-call-leads-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showAlert(`Exported ${leads.length} lead${leads.length !== 1 ? 's' : ''} to CSV.`, 'info');
}

// ============================================
// Data Persistence
// ============================================
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
        showAlert('Warning: Local storage is full. Export your data to avoid losing it.', 'warn');
    }
}

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                leads = parsed;
                renderDashboard();
                renderTable();
            }
        }
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
    }
}

// ============================================
// Utilities
// ============================================
function esc(str) {
    return String(str ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function escAttr(str) {
    return String(str ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function shortUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

function showAlert(message, type) {
    const existing = document.querySelector('.alert');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = `alert alert-${type}`;
    div.textContent = message;

    const searchSection = document.querySelector('.search-section');
    searchSection.parentNode.insertBefore(div, searchSection);

    setTimeout(() => {
        if (div.parentNode) div.remove();
    }, 6000);
}

function clearAlert() {
    const existing = document.querySelector('.alert');
    if (existing) existing.remove();
}
