Cold Call Finder
A clean, minimal, dark-mode web application for finding local businesses to cold call. Built with pure HTML, CSS, and vanilla JavaScript — no frameworks, no build step, no dependencies.
Features
Find businesses nearby using OpenStreetMap (FREE) or Google Places API
Display phone numbers — only businesses with phone numbers are shown
Google Maps links for every business
Notes & last contact date per lead
Status management: To Call, Called, Rejected, Accepted, In Progress
Local storage — everything auto-saves and restores on reopen
Password protection — simple fullscreen login gate
CSV export — download all leads as a spreadsheet
Live search — filter by name, phone, or address instantly
Dashboard statistics — see counts at a glance
Responsive design — works on desktop, tablet, and mobile
Geolocation — auto-detects your location, with manual fallback
Two Data Sources — You Choose
🗺️ OpenStreetMap (Default — FREE, no API key)
The app uses the free Overpass API to query OpenStreetMap data. No registration, no API key, no billing.
Supported niches include:
Restaurants, cafes, bars, pubs, fast food
Dentists, doctors, clinics, hospitals, pharmacies
Hair salons, beauty shops, spas, gyms
Plumbers, electricians, roofers, carpenters, mechanics
Lawyers, accountants, real estate agents, insurance offices
Hotels, hostels, guest houses
Supermarkets, bakeries, butchers, florists
And 50+ more business types
Simply type any business niche and search — it works out of the box.
🔍 Google Places (Optional — requires API key)
For broader coverage or different data, switch to Google Places API (New). Requires a free API key from Google Cloud.
Installation
Download or clone this repository.
Open index.html in any modern web browser.
That's it — no server or build step required.
Note: For Google Places search, you need a Google Places API key. OpenStreetMap works immediately with zero setup.
Google Places API Setup (Optional)
Go to Google Cloud Console.
Create a new project (or select an existing one).
Navigate to APIs & Services > Library.
Search for "Places API (New)" and enable it.
Go to APIs & Services > Credentials.
Click Create Credentials > API Key.
Copy your API key and paste it in the app when prompted.
API Key Restrictions (Recommended)
For security, restrict your API key:
Under Application restrictions, choose HTTP referrers and add your domain (or localhost for local testing).
Under API restrictions, select only Places API (New).
GitHub Pages Deployment
Push all files to a GitHub repository.
Go to Settings > Pages in your repository.
Under Source, select Deploy from a branch.
Choose the main branch and / (root) folder.
Click Save.
Your site will be live at https://yourusername.github.io/repository-name/.
How to Use
Login with the password 26.Af.10.
Allow location access when prompted, or click "Use manual location" to enter a city name.
Choose your data source — OpenStreetMap (free, default) or Google Places (requires API key).
Enter a business niche (e.g., "Restaurant", "Dentist", "Plumber", "Hair Salon").
Select a search radius (5, 10, 25, or 50 km).
Click Search. The app queries the selected API and shows only businesses with phone numbers.
Use the status dropdown to track each lead.
Check the checkbox to mark a lead as called.
Add notes and last contact dates as needed.
Use the search bar to filter your leads.
Click Export CSV to download your leads as a spreadsheet.
Screenshots
Placeholder — add screenshots of the login screen, dashboard, and results table here.
File Structure
plain
.
├── index.html      # Main HTML structure
├── style.css       # All styles (dark mode, responsive)
├── script.js       # All JavaScript logic
└── README.md       # This file
Technology
HTML5 — semantic markup
CSS3 — custom properties, grid, flexbox, media queries
Vanilla JavaScript — ES6+ features, async/await, Fetch API
OpenStreetMap Overpass API — free business search (no key needed)
Google Places API (New) — optional alternative search
OpenStreetMap Nominatim — free geocoding / reverse geocoding
localStorage — client-side persistence
License
MIT License — free to use, modify, and distribute.
