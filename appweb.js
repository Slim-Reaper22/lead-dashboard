const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// State mapping
const stateFullNames = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 
  'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia', 
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 
  'IA': 'Iowa', 'KS': 'Kansas', 'KY': 'Kentucky', 
  'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 
  'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 
  'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 
  'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 
  'NC': 'North Carolina', 'ND': 'North Dakota', 
  'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon', 
  'PA': 'Pennsylvania', 'RI': 'Rhode Island', 
  'SC': 'South Carolina', 'SD': 'South Dakota', 
  'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 
  'VT': 'Vermont', 'VA': 'Virginia', 
  'WA': 'Washington', 'WV': 'West Virginia', 
  'WI': 'Wisconsin', 'WY': 'Wyoming'
};

// Geocoding cache and utilities for city search
const geocodingCache = {}; // Simple cache to avoid repeated API calls

// Simplified geocoding function using OpenStreetMap Nominatim API
async function geocodeCity(cityName) {
  // Check cache first
  if (geocodingCache[cityName]) {
    console.log(`Cache hit for: ${cityName}`);
    return geocodingCache[cityName];
  }
  
  try {
    console.log(`Geocoding: ${cityName}`);
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try with city name and USA
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${cityName}, USA`,
        format: 'json',
        limit: 1,
        addressdetails: 1,
        countrycodes: 'us'
      },
      headers: {
        'User-Agent': 'LocationLeadDashboard/1.0 (contact@encodeset.com)'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.length > 0) {
      const result = {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon),
        displayName: response.data[0].display_name
      };
      
      // Validate coordinates
      if (!isNaN(result.latitude) && !isNaN(result.longitude) && 
          Math.abs(result.latitude) <= 90 && Math.abs(result.longitude) <= 180) {
        
        console.log(`Successfully geocoded ${cityName}:`, result);
        // Cache the result
        geocodingCache[cityName] = result;
        return result;
      }
    }
    
    // If first attempt fails, try common city fallbacks
    const commonCities = {
      'philadelphia': { latitude: 39.9526, longitude: -75.1652, displayName: 'Philadelphia, PA, USA' },
      'bensalem': { latitude: 40.1023, longitude: -74.9510, displayName: 'Bensalem, PA, USA' },
      'new york': { latitude: 40.7128, longitude: -74.0060, displayName: 'New York, NY, USA' },
      'los angeles': { latitude: 34.0522, longitude: -118.2437, displayName: 'Los Angeles, CA, USA' },
      'chicago': { latitude: 41.8781, longitude: -87.6298, displayName: 'Chicago, IL, USA' },
      'houston': { latitude: 29.7604, longitude: -95.3698, displayName: 'Houston, TX, USA' },
      'phoenix': { latitude: 33.4484, longitude: -112.0740, displayName: 'Phoenix, AZ, USA' },
      'san antonio': { latitude: 29.4241, longitude: -98.4936, displayName: 'San Antonio, TX, USA' },
      'san diego': { latitude: 32.7157, longitude: -117.1611, displayName: 'San Diego, CA, USA' },
      'dallas': { latitude: 32.7767, longitude: -96.7970, displayName: 'Dallas, TX, USA' },
      'san jose': { latitude: 37.3382, longitude: -121.8863, displayName: 'San Jose, CA, USA' },
      'austin': { latitude: 30.2672, longitude: -97.7431, displayName: 'Austin, TX, USA' },
      'jacksonville': { latitude: 30.3322, longitude: -81.6557, displayName: 'Jacksonville, FL, USA' },
      'fort worth': { latitude: 32.7555, longitude: -97.3308, displayName: 'Fort Worth, TX, USA' },
      'columbus': { latitude: 39.9612, longitude: -82.9988, displayName: 'Columbus, OH, USA' },
      'charlotte': { latitude: 35.2271, longitude: -80.8431, displayName: 'Charlotte, NC, USA' }
    };
    
    const cityKey = cityName.toLowerCase();
    if (commonCities[cityKey]) {
      console.log(`Using fallback coordinates for: ${cityName}`);
      const result = commonCities[cityKey];
      geocodingCache[cityName] = result;
      return result;
    }
    
    console.log(`No coordinates found for: ${cityName}`);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
}

// Distance calculation function using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Radius of earth in kilometers
  const R = 6371;
  
  // Convert latitude and longitude from degrees to radians
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  // Haversine formula
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  
  // Convert to miles
  return distance * 0.621371;
}

// Ensure public/images directory exists for the background image
if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public');
}
if (!fs.existsSync('./public/images')) {
  fs.mkdirSync('./public/images');
}

// Global variable to store the API data
let leadsData = [];
let isDataLoaded = false;
let dataLoadError = null;
let lastDataRefresh = null;

// SmartSuite API configuration
let smartsuiteConfig = {
  apiKey: process.env.SMARTSUITE_API_KEY || 'c5f0367be5ffdc0f0ff804d8bfc1647b3d9abe38',
  appId: process.env.SMARTSUITE_APP_ID || '67c735724878712509589af7',
  tableId: process.env.SMARTSUITE_TABLE_ID || '67c8fdfb508eb94c4784fb95',
  accountId: process.env.SMARTSUITE_ACCOUNT_ID || 'sxs77u60'
};

// Login credentials (should be stored more securely in production)
const credentials = {
  username: 'csolimine@encodeset.com',
  // Password hash for 'Lyneer10!'
  passwordHash: bcrypt.hashSync('Lyneer10!', 10)
};

// Authentication middleware - now only required for settings
function requireLogin(req, res, next) {
  if (req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Load data from SmartSuite API with enhanced debugging and updated endpoint
async function loadSmartSuiteData() {
  const requestId = Date.now();
  console.log(`[${requestId}] Starting SmartSuite data load at ${new Date().toISOString()}`);
  
  if (!smartsuiteConfig.apiKey || !smartsuiteConfig.tableId) {
    console.log(`[${requestId}] SmartSuite configuration incomplete`);
    return [];
  }

  // Check if we have the required account ID
  if (!smartsuiteConfig.accountId) {
    console.log('WARNING: SmartSuite Account ID is missing, API calls will fail');
    return [];
  }

  try {
    // Using the correct authorization format and base URL as specified in documentation
    const authHeader = `Token ${smartsuiteConfig.apiKey}`;
    const baseUrl = 'https://app.smartsuite.com/api/v1';
    
    // Prepare headers based on documentation
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'ACCOUNT-ID': smartsuiteConfig.accountId,
      'Cache-Control': 'no-cache',
      'X-Request-ID': requestId.toString()
    };
    
    // Log the exact URL and headers being used
    const recordsUrl = `${baseUrl}/applications/${smartsuiteConfig.tableId}/records/list/`;
    console.log(`[${requestId}] Making request to: ${recordsUrl}`);
    console.log(`[${requestId}] Using Account ID: ${smartsuiteConfig.accountId}`);
    console.log(`[${requestId}] Using Table ID: ${smartsuiteConfig.tableId}`);
    
    // Create request body according to the documentation
    const requestBody = {
      sort: [],
      filter: {},
      hydrated: true // Get human-readable values for fields
    };
    
    const response = await axios({
      method: 'POST',
      url: recordsUrl,
      headers: headers,
      data: requestBody,
      timeout: 30000 // 30 second timeout
    });

    console.log(`[${requestId}] Successfully fetched records!`);
    console.log(`[${requestId}] Response status: ${response.status}`);
    console.log(`[${requestId}] Number of items: ${response.data.items ? response.data.items.length : 0}`);
    
    // Log the response structure
    console.log('Response structure:', JSON.stringify({
      total: response.data.total,
      offset: response.data.offset,
      limit: response.data.limit,
      itemCount: response.data.items ? response.data.items.length : 0
    }, null, 2));
    
    // Transform the data to match the expected format with simplified coordinate extraction
    const transformedData = response.data.items.map(item => {
      // Get address components and coordinates
      let address = '';
      let latitude = null;
      let longitude = null;
      
      if (item.s5d25b0846) {
        const loc = item.s5d25b0846;
        
        // Try standard format first
        if (loc.location_address || loc.location_city || loc.location_state) {
          const parts = [
            loc.location_address,
            loc.location_address2,
            loc.location_city,
            loc.location_state,
            loc.location_zip,
            loc.location_country
          ].filter(part => part && part.trim() !== '');
          
          address = parts.join(', ');
          
          // Extract latitude and longitude if available
          if (loc.location_latitude && loc.location_longitude) {
            latitude = parseFloat(loc.location_latitude);
            longitude = parseFloat(loc.location_longitude);
          }
        } 
        // Try alternate formats
        else if (loc.latitude !== undefined && loc.longitude !== undefined) {
          latitude = parseFloat(loc.latitude);
          longitude = parseFloat(loc.longitude);
          
          // Try to build address from available fields
          const addressParts = [];
          if (loc.address) addressParts.push(loc.address);
          if (loc.city) addressParts.push(loc.city);
          if (loc.state) addressParts.push(loc.state);
          if (loc.zip) addressParts.push(loc.zip);
          if (loc.country) addressParts.push(loc.country);
          
          address = addressParts.join(', ');
        }
        // If location is a string, use it as address
        else if (typeof loc === 'string') {
          address = loc;
        }
      }
      
      // Validate coordinates
      if (latitude !== null && longitude !== null) {
        if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || isNaN(latitude) || isNaN(longitude)) {
          console.warn(`Invalid coordinates detected: ${latitude}, ${longitude} - resetting to null`);
          latitude = null;
          longitude = null;
        }
      }
      
      // Extract the new fields for multi-select fields
      let siteType = '';
      let specializedIndustrySite = '';
      let onetIndustrySite = '';

      // Site Type field - using s91e2ac54c (confirmed)
      if (item.s91e2ac54c) {
        if (Array.isArray(item.s91e2ac54c)) {
          siteType = item.s91e2ac54c.map(val => val.label || val).join(', ');
        } else if (typeof item.s91e2ac54c === 'object' && item.s91e2ac54c.label) {
          siteType = item.s91e2ac54c.label;
        } else if (typeof item.s91e2ac54c === 'object' && item.s91e2ac54c.values) {
          siteType = Array.isArray(item.s91e2ac54c.values) 
            ? item.s91e2ac54c.values.map(val => val.label || val).join(', ')
            : item.s91e2ac54c.values;
        } else {
          siteType = String(item.s91e2ac54c);
        }
      }

      // Specialized Industry Site field - using s21hlm59
      if (item.s21hlm59) {
        if (Array.isArray(item.s21hlm59)) {
          specializedIndustrySite = item.s21hlm59.map(val => val.label || val).join(', ');
        } else if (typeof item.s21hlm59 === 'object' && item.s21hlm59.label) {
          specializedIndustrySite = item.s21hlm59.label;
        } else if (typeof item.s21hlm59 === 'object' && item.s21hlm59.values) {
          specializedIndustrySite = Array.isArray(item.s21hlm59.values) 
            ? item.s21hlm59.values.map(val => val.label || val).join(', ')
            : item.s21hlm59.values;
        } else {
          specializedIndustrySite = String(item.s21hlm59);
        }
      }

      // O*NET Industry Site field - using s5530473fb (confirmed)
      if (item.s5530473fb) {
        if (Array.isArray(item.s5530473fb)) {
          onetIndustrySite = item.s5530473fb.map(val => val.label || val).join(', ');
        } else if (typeof item.s5530473fb === 'object' && item.s5530473fb.label) {
          onetIndustrySite = item.s5530473fb.label;
        } else if (typeof item.s5530473fb === 'object' && item.s5530473fb.values) {
          onetIndustrySite = Array.isArray(item.s5530473fb.values) 
            ? item.s5530473fb.values.map(val => val.label || val).join(', ')
            : item.s5530473fb.values;
        } else {
          onetIndustrySite = String(item.s5530473fb);
        }
      }
      
      return {
        'Company': item.s79c2f08d9 || item.title || '',
        'Address': address,
        'Latitude': latitude,
        'Longitude': longitude,
        'Estimated New Jobs': parseInt(item.s20f809da6 || 0),
        'Activity Type': item.s560d452b4 ? item.s560d452b4.label : '',
        'Timeframe': item.s8a9285317 ? item.s8a9285317.label : '',
        'General Lead Summary': item.s54a8cc7de || '',
        'About': item.sb7f0cac0e || '',
        'Site Type': siteType,
        'Specialized Industry Site': specializedIndustrySite,
        'O*NET Industry Site': onetIndustrySite
      };
    });

    console.log(`Transformed ${transformedData.length} records for the dashboard`);
    
    // Log how many records have valid coordinates
    const validCoordinates = transformedData.filter(item => 
      item.Latitude && item.Longitude && 
      !isNaN(item.Latitude) && !isNaN(item.Longitude)
    ).length;
    
    console.log(`Found ${validCoordinates} records with valid coordinates out of ${transformedData.length} total records`);
    
    lastDataRefresh = new Date().toISOString();
    return transformedData;
  } catch (error) {
    console.error(`[${requestId}] Error fetching data from SmartSuite API:`, error.message);
    console.error(`[${requestId}] Error details:`, {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response'
    });
    throw error;
  }
}

// Middleware to check if data is loaded
function ensureDataLoaded(req, res, next) {
  if (!isDataLoaded) {
    if (dataLoadError) {
      return res.status(500).send(`
        <div style="padding: 20px; font-family: Arial; text-align: center;">
          <h1>Failed to load data from SmartSuite</h1>
          <p>Error: ${dataLoadError}</p>
          <p>Please check your configuration and try again.</p>
        </div>
      `);
    }
    return res.status(503).send(`
      <div style="padding: 20px; font-family: Arial; text-align: center;">
        <h1>Application is starting up...</h1>
        <p>Please refresh this page in a moment.</p>
        <script>setTimeout(() => location.reload(), 3000);</script>
      </div>
    `);
  }
  next();
}

// Initialize data on startup
(async function() {
  try {
    console.log('Starting data initialization...');
    // Load the data from SmartSuite
    if (smartsuiteConfig.apiKey) {
      leadsData = await loadSmartSuiteData();
      isDataLoaded = true;
      console.log('Data initialization complete');
    } else {
      dataLoadError = 'SmartSuite API key not configured';
      console.error(dataLoadError);
    }
  } catch (error) {
    dataLoadError = error.message;
    console.error('Error loading initial data:', error);
  }
})();

// Function to extract and count states from lead addresses
function calculateStateDistribution(leads) {
  const stateCounts = {};
  
  leads.forEach(lead => {
    if (lead.Address) {
      const addressParts = lead.Address.split(',').map(part => part.trim());
      
      // Look for state in the address
      if (addressParts.length >= 2) {
        let stateFound = false;
        
        // Check last part first (might be "State ZIP")
        const lastPart = addressParts[addressParts.length - 1];
        const stateMatch = lastPart.match(/^([A-Z]{2})\s+\d{5}/) || lastPart.match(/^([A-Z]{2})$/);
        
        if (stateMatch) {
          const stateAbbr = stateMatch[1];
          const stateName = stateFullNames[stateAbbr];
          if (stateName) {
            stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;
            stateFound = true;
          }
        }
        
        // If not found, check second-to-last part
        if (!stateFound && addressParts.length >= 3) {
          const secondLastPart = addressParts[addressParts.length - 2];
          
          // Check for state abbreviation
          const abbrevMatch = secondLastPart.match(/^([A-Z]{2})$/);
          if (abbrevMatch) {
            const stateAbbr = abbrevMatch[1];
            const stateName = stateFullNames[stateAbbr];
            if (stateName) {
              stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;
              stateFound = true;
            }
          }
          
          // Check for full state name
          if (!stateFound) {
            for (const [abbr, fullName] of Object.entries(stateFullNames)) {
              if (secondLastPart.toLowerCase() === fullName.toLowerCase()) {
                stateCounts[fullName] = (stateCounts[fullName] || 0) + 1;
                stateFound = true;
                break;
              }
            }
          }
        }
        
        // Last resort: search entire address for state names
        if (!stateFound) {
          const fullAddress = lead.Address.toLowerCase();
          for (const [abbr, fullName] of Object.entries(stateFullNames)) {
            if (fullAddress.includes(fullName.toLowerCase()) || 
                fullAddress.includes(`, ${abbr.toLowerCase()},`) ||
                fullAddress.includes(`, ${abbr.toLowerCase()} `)) {
              stateCounts[fullName] = (stateCounts[fullName] || 0) + 1;
              break;
            }
          }
        }
      }
    }
  });
  
  return stateCounts;
}

// Function to extract and count cities from lead addresses
function calculateCityDistribution(leads) {
  const cityCounts = {};
  
  // Create a set of all state names (both full names and abbreviations) for exclusion
  const stateNames = new Set();
  Object.entries(stateFullNames).forEach(([abbr, fullName]) => {
    stateNames.add(fullName.toLowerCase());
    stateNames.add(abbr.toLowerCase());
  });
  
  leads.forEach((lead, index) => {
    if (lead.Address) {
      // Extract city from address
      const addressParts = lead.Address.split(',').map(part => part.trim());
      
      if (addressParts.length >= 2) {
        let cityName = '';
        
        // Check if first part is a city by seeing if second part is a state
        const firstPart = addressParts[0];
        const secondPart = addressParts[1];
        
        // If the second part is a state, then first part is likely the city
        if (stateNames.has(secondPart.toLowerCase()) || 
            Object.keys(stateFullNames).some(abbr => secondPart.toUpperCase() === abbr)) {
          cityName = firstPart;
        } else if (addressParts.length >= 3) {
          // Otherwise, for longer addresses, city is usually second part
          cityName = secondPart;
        } else {
          // For 2-part addresses where second isn't a state, assume first is city
          cityName = firstPart;
        }
        
        // Clean up city name - remove numbers, extra spaces, and common prefixes
        cityName = cityName.replace(/^\d+\s+/, '') // Remove leading numbers
                          .replace(/\s+/g, ' ')    // Normalize spaces
                          .trim();
        
        // Remove "County" from city names (e.g., "New Castle County" -> "New Castle")
        if (cityName.toLowerCase().endsWith(' county')) {
          cityName = cityName.substring(0, cityName.length - 7).trim();
        }
        
        // Skip if this is a state name
        if (stateNames.has(cityName.toLowerCase())) {
          return; // Skip this iteration
        }
        
        // Skip if this is "United States" or a country name
        if (cityName.toLowerCase() === 'united states' || 
            cityName.toLowerCase() === 'usa' ||
            cityName.toLowerCase() === 'us') {
          return;
        }
        
        // Filter out very short names, numbers, or common non-city terms
        if (cityName.length > 2 && 
            !cityName.match(/^\d+$/) && 
            !cityName.match(/^\d{5}$/) && // Skip zip codes
            !cityName.toLowerCase().includes('street') &&
            !cityName.toLowerCase().includes('avenue') &&
            !cityName.toLowerCase().includes('road') &&
            !cityName.toLowerCase().includes('blvd') &&
            !cityName.toLowerCase().includes('suite') &&
            !cityName.toLowerCase().includes('drive') &&
            !cityName.toLowerCase().includes('lane') &&
            !cityName.toLowerCase().includes('way') &&
            !cityName.toLowerCase().includes('highway') &&
            !cityName.toLowerCase().includes('route') &&
            !cityName.toLowerCase().includes('plaza') &&
            !cityName.toLowerCase().includes('court') &&
            !cityName.toLowerCase().includes('building') &&
            !cityName.toLowerCase().includes('floor') &&
            !cityName.toLowerCase().includes('parkway') &&
            !cityName.toLowerCase().includes('pike') &&
            !cityName.toLowerCase().includes('turnpike') &&
            cityName !== 'N/A') {
          
          // Capitalize first letter of each word for consistency
          cityName = cityName.split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(' ');
          
          cityCounts[cityName] = (cityCounts[cityName] || 0) + 1;
        }
      }
    }
  });
  
  return cityCounts;
}

// Calculate additional analytics for the dashboard
function calculateDashboardMetrics(leads) {
  // Activity Type Distribution
  const activityCounts = {};
  leads.forEach(lead => {
    const activity = lead['Activity Type'] || 'Unknown';
    activityCounts[activity] = (activityCounts[activity] || 0) + 1;
  });
  
  // Timeframe Distribution
  const timeframeCounts = {};
  leads.forEach(lead => {
    const timeframe = lead['Timeframe'] || 'Unknown';
    timeframeCounts[timeframe] = (timeframeCounts[timeframe] || 0) + 1;
  });
  
  // Site Type Distribution
  const siteTypeCounts = {};
  leads.forEach(lead => {
    const siteType = lead['Site Type'] || 'Unknown';
    // Handle multiple site types separated by commas
    if (siteType.includes(',')) {
      const types = siteType.split(',').map(t => t.trim());
      types.forEach(type => {
        if (type) {
          siteTypeCounts[type] = (siteTypeCounts[type] || 0) + 1;
        }
      });
    } else {
      siteTypeCounts[siteType] = (siteTypeCounts[siteType] || 0) + 1;
    }
  });
  
  // Add State Distribution
  const stateCounts = calculateStateDistribution(leads);
  
  // Add City Distribution
  const cityCounts = calculateCityDistribution(leads);
  
  return {
    activityCounts,
    timeframeCounts,
    siteTypeCounts,
    stateCounts,
    cityCounts
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
    memory_usage: process.memoryUsage(),
    data: {
      loaded: isDataLoaded,
      total_records: leadsData.length,
      records_with_coordinates: leadsData.filter(l => l.Latitude && l.Longitude).length,
      last_refresh: lastDataRefresh || 'never'
    },
    smartsuite_config: {
      has_api_key: !!smartsuiteConfig.apiKey,
      account_id: smartsuiteConfig.accountId,
      table_id: smartsuiteConfig.tableId
    }
  };
  
  res.json(status);
});

// Main dashboard route - no login required
app.get('/', ensureDataLoaded, (req, res) => {
  // Generate a complete list of all 50 states
  const states = Object.values(stateFullNames).sort();
  
  // Calculate metrics for all leads
  const totalLeads = leadsData.length;
  const totalJobs = leadsData.reduce((sum, lead) => sum + (parseInt(lead['Estimated New Jobs']) || 0), 0);
  const activityTypes = [...new Set(leadsData.map(lead => lead['Activity Type'] || 'Unknown'))];
  const totalActivityTypes = activityTypes.length;
  
  // Activity type distribution
  const activityCounts = {};
  activityTypes.forEach(type => {
    activityCounts[type] = leadsData.filter(lead => lead['Activity Type'] === type).length;
  });
  
  // Calculate additional dashboard metrics
  const dashboardMetrics = calculateDashboardMetrics(leadsData);
  
  // Handle absence of favicon.ico
  if (!fs.existsSync('./public/favicon.ico')) {
    // Create an empty favicon.ico to prevent 404 errors
    fs.writeFileSync('./public/favicon.ico', '');
  }
  
  // Check for encodeset-logo.png and create a placeholder if it doesn't exist
  const logoPath = './public/images/encodeset-logo.png';
  if (!fs.existsSync(logoPath)) {
    console.log('Warning: Logo file not found. Create a logo file at: ' + logoPath);
    // You might want to add code here to create a placeholder logo
  }
  
  res.render('dashboard', { 
    leads: leadsData,
    states: states,
    stateFullNames: stateFullNames,
    totalLeads,
    totalJobs,
    totalActivityTypes,
    activityCounts,
    dashboardMetrics,
    stateCounts: dashboardMetrics.stateCounts,
    cityCounts: dashboardMetrics.cityCounts,
    selectedState: null,
    searchTerm: null,
    isLoggedIn: req.session.loggedIn || false // Pass login status to template
  });
});

// State filter route - no login required
app.get('/filter', ensureDataLoaded, (req, res) => {
  const { state } = req.query;
  
  // Generate a complete list of all 50 states
  const states = Object.values(stateFullNames).sort();
  
  // Filter leads by state if state is provided
  let filteredLeads = leadsData;
  if (state && state !== 'All States') {
    filteredLeads = leadsData.filter(lead => {
      const address = lead.Address || '';
      
      // Check for both full state name and abbreviation in the address
      const stateAbbr = Object.keys(stateFullNames).find(abbr => stateFullNames[abbr] === state);
      
      return address.toLowerCase().includes(state.toLowerCase()) || 
             (stateAbbr && (address.includes(`, ${stateAbbr} `) || address.includes(`, ${stateAbbr},`) || address.endsWith(`, ${stateAbbr}`)));
    });
  }
  
  // Calculate metrics for filtered leads
  const totalLeads = filteredLeads.length;
  const totalJobs = filteredLeads.reduce((sum, lead) => sum + (parseInt(lead['Estimated New Jobs']) || 0), 0);
  const activityTypes = [...new Set(filteredLeads.map(lead => lead['Activity Type'] || 'Unknown'))];
  const totalActivityTypes = activityTypes.length;
  
  // Activity type distribution
  const activityCounts = {};
  activityTypes.forEach(type => {
    activityCounts[type] = filteredLeads.filter(lead => lead['Activity Type'] === type).length;
  });
  
  // Calculate dashboard metrics for FILTERED leads, not all leads
  const dashboardMetrics = calculateDashboardMetrics(filteredLeads);
  
  res.render('dashboard', { 
    leads: filteredLeads,
    states: states,
    stateFullNames: stateFullNames,
    totalLeads,
    totalJobs,
    totalActivityTypes,
    activityCounts,
    dashboardMetrics,
    stateCounts: dashboardMetrics.stateCounts,
    cityCounts: dashboardMetrics.cityCounts,
    selectedState: state,
    searchTerm: null,
    isLoggedIn: req.session.loggedIn || false
  });
});

// Company search route - no login required
app.get('/search', ensureDataLoaded, (req, res) => {
  const { company } = req.query;
  
  // Generate a complete list of all 50 states
  const states = Object.values(stateFullNames).sort();
  
  // Filter leads by company name if search term is provided
  let filteredLeads = leadsData;
  if (company && company.trim() !== '') {
    const searchTerm = company.toLowerCase().trim();
    filteredLeads = leadsData.filter(lead => {
      const companyName = (lead.Company || '').toLowerCase();
      return companyName.includes(searchTerm);
    });
  }
  
  // Calculate metrics for filtered leads
  const totalLeads = filteredLeads.length;
  const totalJobs = filteredLeads.reduce((sum, lead) => sum + (parseInt(lead['Estimated New Jobs']) || 0), 0);
  const activityTypes = [...new Set(filteredLeads.map(lead => lead['Activity Type'] || 'Unknown'))];
  const totalActivityTypes = activityTypes.length;
  
  // Activity type distribution
  const activityCounts = {};
  activityTypes.forEach(type => {
    activityCounts[type] = filteredLeads.filter(lead => lead['Activity Type'] === type).length;
  });
  
  // Calculate additional dashboard metrics
  const dashboardMetrics = calculateDashboardMetrics(filteredLeads);
  
  res.render('dashboard', { 
    leads: filteredLeads,
    states: states,
    stateFullNames: stateFullNames,
    totalLeads,
    totalJobs,
    totalActivityTypes,
    activityCounts,
    dashboardMetrics,
    stateCounts: dashboardMetrics.stateCounts,
    cityCounts: dashboardMetrics.cityCounts,
    selectedState: null,
    searchTerm: company, // Pass the search term to the template
    isLoggedIn: req.session.loggedIn || false
  });
});

// City search route - HYBRID VERSION combining the best of both approaches
app.get('/city-search', ensureDataLoaded, async (req, res) => {
  const { city, radius } = req.query;
  
  console.log('City search request:', { city, radius });
  
  if (!city || city.trim() === '') {
    return res.redirect('/');
  }
  
  // Convert radius to number, default to 50 miles if invalid
  const searchRadius = parseFloat(radius) || 50;
  
  try {
    // Geocode the city to get coordinates
    const cityCoordinates = await geocodeCity(city);
    
    if (!cityCoordinates) {
      console.log('Geocoding failed for city:', city);
      // If geocoding fails, render with error message
      const states = Object.values(stateFullNames).sort();
      
      // Calculate basic metrics with all leads since we can't filter
      const dashboardMetrics = calculateDashboardMetrics([]);
      
      return res.render('dashboard', {
        leads: [],
        states: states,
        stateFullNames: stateFullNames,
        totalLeads: 0,
        totalJobs: 0,
        totalActivityTypes: 0,
        activityCounts: {},
        dashboardMetrics,
        stateCounts: {},
        cityCounts: {},
        selectedState: null,
        searchTerm: null,
        citySearchTerm: city,
        citySearchRadius: searchRadius,
        citySearchError: `Could not find coordinates for "${city}". Please try a different city name.`,
        isLoggedIn: req.session.loggedIn || false
      });
    }
    
    // Filter leads within the specified radius
    const filteredLeads = [];
    
    leadsData.forEach(lead => {
      // Skip leads without coordinates
      if (!lead.Latitude || !lead.Longitude || isNaN(lead.Latitude) || isNaN(lead.Longitude)) {
        return;
      }
      
      // Calculate distance
      const distance = calculateDistance(
        cityCoordinates.latitude,
        cityCoordinates.longitude,
        lead.Latitude,
        lead.Longitude
      );
      
      // Include if within radius
      if (distance <= searchRadius) {
        // Create a new object with distance property to avoid mutation
        filteredLeads.push({
          ...lead,
          distance: distance.toFixed(1)
        });
      }
    });
    
    console.log(`Found ${filteredLeads.length} leads within ${searchRadius} miles of ${city}`);
    
    // Sort by distance (closest first)
    filteredLeads.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    
    // Calculate metrics for filtered leads
    const totalLeads = filteredLeads.length;
    const totalJobs = filteredLeads.reduce((sum, lead) => sum + (parseInt(lead['Estimated New Jobs']) || 0), 0);
    const activityTypes = [...new Set(filteredLeads.map(lead => lead['Activity Type'] || 'Unknown'))];
    const totalActivityTypes = activityTypes.length;
    
    // Activity type distribution
    const activityCounts = {};
    activityTypes.forEach(type => {
      activityCounts[type] = filteredLeads.filter(lead => lead['Activity Type'] === type).length;
    });
    
    // Calculate additional dashboard metrics
    const dashboardMetrics = calculateDashboardMetrics(filteredLeads);
    
    // Generate a complete list of all 50 states
    const states = Object.values(stateFullNames).sort();
    
    res.render('dashboard', {
      leads: filteredLeads,
      states: states,
      stateFullNames: stateFullNames,
      totalLeads,
      totalJobs,
      totalActivityTypes,
      activityCounts,
      dashboardMetrics,
      stateCounts: dashboardMetrics.stateCounts,
      cityCounts: dashboardMetrics.cityCounts,
      selectedState: null,
      searchTerm: null,
      citySearchTerm: city,
      citySearchRadius: searchRadius,
      citySearchCoordinates: cityCoordinates,
      isLoggedIn: req.session.loggedIn || false
    });
  } catch (error) {
    console.error('City search error:', error);
    // If there's an error, redirect to the home page
    res.redirect('/');
  }
});

// Login routes
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === credentials.username) {
    const match = await bcrypt.compare(password, credentials.passwordHash);
    if (match) {
      req.session.loggedIn = true;
      
      // Redirect to settings if they were trying to access settings
      // Otherwise redirect to dashboard
      const returnTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      return res.redirect(returnTo);
    }
  }
  
  res.render('login', { error: 'Invalid username or password' });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Settings routes - requires login
app.get('/settings', (req, res, next) => {
  if (!req.session.loggedIn) {
    req.session.returnTo = '/settings';
    return res.redirect('/login');
  }
  next();
}, (req, res) => {
  res.render('settings', { 
    message: null, 
    config: {
      apiKey: smartsuiteConfig.apiKey ? '********' : '',
      appId: smartsuiteConfig.appId,
      tableId: smartsuiteConfig.tableId,
      accountId: smartsuiteConfig.accountId
    }
  });
});

// Route to update SmartSuite API settings
app.post('/update-api-config', requireLogin, async (req, res) => {
  const { apiKey, appId, tableId, accountId } = req.body;
  
  // Update configuration - only update fields that are not empty
  smartsuiteConfig = {
    apiKey: apiKey || smartsuiteConfig.apiKey,
    appId: appId || smartsuiteConfig.appId,
    tableId: tableId || smartsuiteConfig.tableId,
    accountId: accountId || smartsuiteConfig.accountId
  };
  
  // Save configuration (implement your preferred method)
  // For example: fs.writeFileSync('./config.json', JSON.stringify(smartsuiteConfig));
  
  try {
    // Refresh data from API
    leadsData = await loadSmartSuiteData();
    res.render('settings', { 
      message: 'API configuration updated and data refreshed successfully!',
      config: {
        apiKey: smartsuiteConfig.apiKey ? '********' : '',
        appId: smartsuiteConfig.appId,
        tableId: smartsuiteConfig.tableId,
        accountId: smartsuiteConfig.accountId
      }
    });
  } catch (error) {
    console.error('Error updating API config:', error);
    res.render('settings', { 
      message: `Error updating API configuration: ${error.message}`,
      config: {
        apiKey: smartsuiteConfig.apiKey ? '********' : '',
        appId: smartsuiteConfig.appId,
        tableId: smartsuiteConfig.tableId,
        accountId: smartsuiteConfig.accountId
      }
    });
  }
});

// Route to manually refresh data
app.post('/refresh-data', requireLogin, async (req, res) => {
  try {
    leadsData = await loadSmartSuiteData();
    res.render('settings', { 
      message: 'Data refreshed successfully!',
      config: {
        apiKey: smartsuiteConfig.apiKey ? '********' : '',
        appId: smartsuiteConfig.appId,
        tableId: smartsuiteConfig.tableId,
        accountId: smartsuiteConfig.accountId
      }
    });
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.render('settings', { 
      message: `Error refreshing data: ${error.message}`,
      config: {
        apiKey: smartsuiteConfig.apiKey ? '********' : '',
        appId: smartsuiteConfig.appId,
        tableId: smartsuiteConfig.tableId,
        accountId: smartsuiteConfig.accountId
      }
    });
  }
});

// API route for dashboard data (for potential AJAX updates)
app.get('/api/dashboard-data', ensureDataLoaded, (req, res) => {
  // Calculate summary metrics
  const totalLeads = leadsData.length;
  const totalJobs = leadsData.reduce((sum, lead) => sum + (parseInt(lead['Estimated New Jobs']) || 0), 0);
  const avgJobsPerLead = Math.round(totalJobs / (totalLeads || 1));
  
  // Calculate additional dashboard metrics
  const dashboardMetrics = calculateDashboardMetrics(leadsData);
  
  // Return JSON data
  res.json({
    summary: {
      totalLeads,
      totalJobs,
      avgJobsPerLead,
      totalActivityTypes: Object.keys(dashboardMetrics.activityCounts).length
    },
    distribution: dashboardMetrics
  });
});

// Add a route to serve favicon.ico to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  // If favicon doesn't exist, create an empty one
  if (!fs.existsSync('./public/favicon.ico')) {
    fs.writeFileSync('./public/favicon.ico', '');
  }
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// Set up automatic data refresh every 5 minutes
setInterval(async () => {
  try {
    console.log('Auto-refreshing data from SmartSuite...');
    leadsData = await loadSmartSuiteData();
    console.log('Auto-refresh completed successfully');
  } catch (error) {
    console.error('Error during auto-refresh:', error);
  }
}, 5 * 60 * 1000); // 5 minutes in milliseconds

app.listen(port, () => {
  console.log(`Lead Dashboard app listening at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Using SmartSuite Account ID: ${smartsuiteConfig.accountId}`);
  console.log(`Using SmartSuite Table ID: ${smartsuiteConfig.tableId}`);
});
