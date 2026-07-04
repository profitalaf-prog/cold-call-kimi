/**
 * Cold Call Finder — Main Application Script
 * Pure vanilla JavaScript, no frameworks, no dependencies.
 */

// ============================================
// Configuration
// ============================================
const PASSWORD = '26.Af.10';
const STORAGE_KEY = 'coldcallfinder_data';
const STORAGE_AUTH = 'coldcallfinder_auth';
const PLACES_API_KEY = ''; // User must set their Google Places API key

// ============================================
// State
// ============================================
let leads = [];
let userLocation = null;
let locationName = '';
let isSearching = false;

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
});

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
            // Try to get location name via reverse geocoding
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
    // Use OpenStreetMap Nominatim for free reverse geocoding
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
    .catch(() => {
        // Silent fail — location name is optional
    });
}

function setManualLocation() {
    const query = $('manualLocationInput').value.trim();
    if (!query) return;

    $('locationStatus').textContent = 'Looking up location...';

    // Geocode the manual location using OpenStreetMap Nominatim
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

// ============================================
// Search — Google Places API (New)
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

    const apiKey = localStorage.getItem('coldcallfinder_apikey');
    if (!apiKey) {
        const key = prompt('Enter your Google Places API key:\n\nGet one at: https://developers.google.com/maps/documentation/places/web-service/get-api-key\n\nYour key is saved locally in your browser.');
        if (!key || !key.trim()) {
            showAlert('A Google Places API key is required to search for businesses.', 'warn');
            return;
        }
        localStorage.setItem('coldcallfinder_apikey', key.trim());
    }

    const finalKey = localStorage.getItem('coldcallfinder_apikey');
    const radius = parseInt($('radiusSelect').value, 10);

    setSearching(true);
    clearAlert();

    try {
        // Step 1: Text Search to find place IDs
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
                'X-Goog-Api-Key': finalKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus,places.location'
            },
            body: JSON.stringify(searchBody)
        });

        if (!searchRes.ok) {
            const errData = await searchRes.json().catch(() => ({}));
            const msg = errData.error?.message || `HTTP ${searchRes.status}`;
            if (searchRes.status === 403 || searchRes.status === 401) {
                localStorage.removeItem('coldcallfinder_apikey');
                throw new Error('Invalid API key or API not enabled. Please enable the Places API (New) in your Google Cloud Console and try again.');
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

        // Step 2: Build lead objects, filtering for phone numbers
        let added = 0;
        const existingIds = new Set(leads.map(l => l.id));

        for (const place of places) {
            const phone = place.internationalPhoneNumber || '';
            if (!phone) continue; // Skip businesses without phone numbers

            const id = place.id || `${place.displayName?.text || ''}-${place.formattedAddress || ''}`;
            if (existingIds.has(id)) continue; // Skip duplicates

            const lead = {
                id: id,
                name: place.displayName?.text || 'Unknown',
                phone: phone,
                address: place.formattedAddress || '',
                website: place.websiteUri || '',
                mapsLink: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.location?.latitude || 0)},${encodeURIComponent(place.location?.longitude || 0)}`,
                rating: place.rating || null,
                reviews: place.userRatingCount || 0,
                category: place.primaryTypeDisplayName?.text || niche,
                status: 'tocall',
                notes: '',
                lastContact: '',
                called: false,
                createdAt: Date.now()
            };

            leads.push(lead);
            existingIds.add(id);
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
    } catch (err) {
        console.error('Search error:', err);
        showAlert(err.message || 'Search failed. Check your API key and internet connection.', 'error');
    } finally {
        setSearching(false);
    }
}

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
            </div>
        `;
        return;
    }

    // Filter leads
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

    // Sort: status order, then by name
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
            ? `<a href="${escAttr(lead.mapsLink)}" target="_blank" rel="noopener" class="maps-link" title="Open in Google Maps">\uD83D\uDCCD</a>`
            : '—';

        const statusSelect = `<select class="status-select" data-id="${escAttr(lead.id)}">` +
            statusOptions.map(o => `<option value="${o.value}"${lead.status === o.value ? ' selected' : ''}>${o.label}</option>`).join('') +
            `</select>`;

        html += `<tr class="${statusClass}">`;
        html += `<td class="td-check"><input type="checkbox" class="lead-check" data-id="${escAttr(lead.id)}"${lead.called ? ' checked' : ''}></td>`;
        html += `<td>${statusSelect}</td>`;
        html += `<td><strong>${esc(lead.name)}</strong><br><span style="color:var(--text-muted);font-size:11px">${esc(lead.category || '')}</span></td>`;
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

    // Attach event listeners to dynamic elements
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
    // Status change
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

    // Checkbox (Called / Not Called)
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

    // Notes
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

    // Last contact date
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

    // Delete
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

    // Select all
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

    const headers = ['Status', 'Business Name', 'Phone', 'Address', 'Website', 'Google Maps', 'Rating', 'Reviews', 'Category', 'Notes', 'Last Contact', 'Called'];
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
        l.called ? 'Yes' : 'No'
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

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
        if (div.parentNode) div.remove();
    }, 6000);
}

function clearAlert() {
    const existing = document.querySelector('.alert');
    if (existing) existing.remove();
}
