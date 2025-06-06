const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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

// Geocoding cache to avoid repeated API calls
const geocodingCache = {};

// Fixed geocoding function using correct Photon API parameters
async function geocodeCity(cityName) {
  // Check cache first
  if (geocodingCache[cityName]) {
    console.log(`Cache hit for: ${cityName}`);
    return geocodingCache[cityName];
  }
  
  try {
    console.log(`Geocoding: ${cityName}`);
    
    // Try Photon API with correct parameters
    const response = await axios.get('https://photon.komoot.io/api/', {
      params: {
        q: `${cityName}, USA`,  // Include USA in the query
        limit: 1,
        lang: 'en'
        // Note: Photon doesn't support 'countrycodes' parameter
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'LocationLeadDashboard/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (response.data.features && response.data.features.length > 0) {
      const feature = response.data.features[0];
      const coords = feature.geometry.coordinates;
      const props = feature.properties;
      
      // Build display name from properties
      let displayName = props.name || cityName;
      if (props.state) {
        displayName += `, ${props.state}`;
      } else if (props.city) {
        displayName += `, ${props.city}`;
      }
      if (props.country) {
        displayName += `, ${props.country}`;
      } else {
        displayName += ', USA';
      }
      
      const result = {
        latitude: coords[1],
        longitude: coords[0],
        displayName: displayName
      };
      
      // Validate US coordinates (rough bounding box for continental US + Alaska/Hawaii)
      if (result.longitude >= -180 && result.longitude <= -65 && 
          result.latitude >= 20 && result.latitude <= 72) {
        geocodingCache[cityName] = result;
        console.log(`Successfully geocoded ${cityName} using Photon:`, result);
        return result;
      } else {
        console.log(`Coordinates outside US bounds for ${cityName}`);
      }
    }
  } catch (error) {
    console.error('Photon geocoding error:', error.message);
  }
  
  // Fallback to hardcoded common cities
  const commonCities = {
    'trenton': { latitude: 40.2171, longitude: -74.7429, displayName: 'Trenton, NJ, USA' },
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
    'charlotte': { latitude: 35.2271, longitude: -80.8431, displayName: 'Charlotte, NC, USA' },
    'san francisco': { latitude: 37.7749, longitude: -122.4194, displayName: 'San Francisco, CA, USA' },
    'indianapolis': { latitude: 39.7684, longitude: -86.1581, displayName: 'Indianapolis, IN, USA' },
    'seattle': { latitude: 47.6062, longitude: -122.3321, displayName: 'Seattle, WA, USA' },
    'denver': { latitude: 39.7392, longitude: -104.9903, displayName: 'Denver, CO, USA' },
    'washington': { latitude: 38.9072, longitude: -77.0369, displayName: 'Washington, DC, USA' },
    'boston': { latitude: 42.3601, longitude: -71.0589, displayName: 'Boston, MA, USA' },
    'el paso': { latitude: 31.7619, longitude: -106.4850, displayName: 'El Paso, TX, USA' },
    'detroit': { latitude: 42.3314, longitude: -83.0458, displayName: 'Detroit, MI, USA' },
    'nashville': { latitude: 36.1627, longitude: -86.7816, displayName: 'Nashville, TN, USA' },
    'portland': { latitude: 45.5152, longitude: -122.6784, displayName: 'Portland, OR, USA' },
    'memphis': { latitude: 35.1495, longitude: -90.0490, displayName: 'Memphis, TN, USA' },
    'oklahoma city': { latitude: 35.4676, longitude: -97.5164, displayName: 'Oklahoma City, OK, USA' },
    'las vegas': { latitude: 36.1699, longitude: -115.1398, displayName: 'Las Vegas, NV, USA' },
    'louisville': { latitude: 38.2527, longitude: -85.7585, displayName: 'Louisville, KY, USA' },
    'baltimore': { latitude: 39.2904, longitude: -76.6122, displayName: 'Baltimore, MD, USA' },
    'milwaukee': { latitude: 43.0389, longitude: -87.9065, displayName: 'Milwaukee, WI, USA' },
    'albuquerque': { latitude: 35.0844, longitude: -106.6504, displayName: 'Albuquerque, NM, USA' },
    'tucson': { latitude: 32.2226, longitude: -110.9747, displayName: 'Tucson, AZ, USA' },
    'fresno': { latitude: 36.7378, longitude: -119.7871, displayName: 'Fresno, CA, USA' },
    'sacramento': { latitude: 38.5816, longitude: -121.4944, displayName: 'Sacramento, CA, USA' },
    'kansas city': { latitude: 39.0997, longitude: -94.5786, displayName: 'Kansas City, MO, USA' },
    'mesa': { latitude: 33.4152, longitude: -111.8315, displayName: 'Mesa, AZ, USA' },
    'atlanta': { latitude: 33.7490, longitude: -84.3880, displayName: 'Atlanta, GA, USA' },
    'omaha': { latitude: 41.2565, longitude: -95.9345, displayName: 'Omaha, NE, USA' },
    'colorado springs': { latitude: 38.8339, longitude: -104.8214, displayName: 'Colorado Springs, CO, USA' },
    'raleigh': { latitude: 35.7796, longitude: -78.6382, displayName: 'Raleigh, NC, USA' },
    'virginia beach': { latitude: 36.8529, longitude: -75.9780, displayName: 'Virginia Beach, VA, USA' },
    'long beach': { latitude: 33.7701, longitude: -118.1937, displayName: 'Long Beach, CA, USA' },
    'miami': { latitude: 25.7617, longitude: -80.1918, displayName: 'Miami, FL, USA' },
    'oakland': { latitude: 37.8044, longitude: -122.2712, displayName: 'Oakland, CA, USA' },
    'minneapolis': { latitude: 44.9778, longitude: -93.2650, displayName: 'Minneapolis, MN, USA' },
    'tulsa': { latitude: 36.1540, longitude: -95.9928, displayName: 'Tulsa, OK, USA' },
    'cleveland': { latitude: 41.4993, longitude: -81.6944, displayName: 'Cleveland, OH, USA' },
    'wichita': { latitude: 37.6872, longitude: -97.3301, displayName: 'Wichita, KS, USA' },
    'arlington': { latitude: 32.7357, longitude: -97.1081, displayName: 'Arlington, TX, USA' }
  };
  
  // Try to match with common cities (case-insensitive)
  const normalizedCity = cityName.toLowerCase().trim();
  if (commonCities[normalizedCity]) {
    console.log(`Using hardcoded coordinates for: ${cityName}`);
    const result = commonCities[normalizedCity];
    geocodingCache[cityName] = result;
    return result;
  }
  
  // Check if it's a "city, state" format and try just the city
  if (cityName.includes(',')) {
    const cityOnly = cityName.split(',')[0].trim().toLowerCase();
    if (commonCities[cityOnly]) {
      console.log(`Using hardcoded coordinates for city part: ${cityOnly}`);
      const result = commonCities[cityOnly];
      geocodingCache[cityName] = result;
      return result;
    }
  }
  
  console.log(`No coordinates found for: ${cityName}`);
  return null;
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
const smartsuiteConfig = {
  apiKey: process.env.SMARTSUITE_API_KEY || 'c5f0367be5ffdc0f0ff804d8bfc1647b3d9abe38',
  appId: process.env.SMARTSUITE_APP_ID || '67c735724878712509589af7',
  tableId: process.env.SMARTSUITE_TABLE_ID || '67c8fdfb508eb94c4784fb95',
  accountId: process.env.SMARTSUITE_ACCOUNT_ID || 'sxs77u60'
};

// Function to geocode addresses for records without coordinates
async function geocodeAddressesForRecords(records) {
  console.log(`Attempting to geocode ${records.length} records...`);
  
  // Process records in batches to avoid overwhelming the geocoding service
  const BATCH_SIZE = 5;
  const DELAY_MS = 1000; // 1 second delay between batches
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (record) => {
      // Only geocode if we don't have coordinates and we have an address
      if ((!record.Latitude || !record.Longitude) && record.Address) {
        try {
          console.log(`Geocoding address: ${record.Address}`);
          const coords = await geocodeCity(record.Address);
          
          if (coords) {
            record.Latitude = coords.latitude;
            record.Longitude = coords.longitude;
            console.log(`Successfully geocoded: ${record.Company} at ${coords.latitude}, ${coords.longitude}`);
          } else {
            console.log(`Failed to geocode: ${record.Company}`);
          }
        } catch (error) {
          console.error(`Error geocoding ${record.Company}:`, error.message);
        }
      }
    }));
    
    // Add delay between batches to respect rate limits
    if (i + BATCH_SIZE < records.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  // Log final statistics
  const geocodedCount = records.filter(r => r.Latitude && r.Longitude).length;
  console.log(`Geocoding complete. ${geocodedCount} out of ${records.length} records now have coordinates.`);
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
    
    // Log the first record to understand its structure
    if (response.data.items && response.data.items.length > 0) {
      console.log('Sample record structure:');
      const sampleRecord = response.data.items[0];
      console.log(JSON.stringify(sampleRecord, null, 2));
      
      // Log all field names in the first record to help with mapping
      console.log('Available fields in records:');
      const fieldNames = Object.keys(sampleRecord);
      console.log(fieldNames);
    } else {
      console.log('No records found in the response');
      return [];
    }

    // Transform the data to match the expected format with enhanced coordinate extraction
    const transformedData = response.data.items.map(item => {
      // Get address components and coordinates
      let address = '';
      let latitude = null;
      let longitude = null;
      
      // First, log the structure of the location field for debugging
      if (item.s5d25b0846) {
        console.log('Location field structure:', JSON.stringify(item.s5d25b0846, null, 2));
      }
      
      // Try multiple possible location field formats
      if (item.s5d25b0846) {
        const loc = item.s5d25b0846;
        
        // Check if it's a SmartSuite location object with nested structure
        if (typeof loc === 'object') {
          // Try different possible nested structures
          
          // 1. Check for location object with direct lat/lng properties
          if (loc.latitude !== undefined && loc.longitude !== undefined) {
            latitude = parseFloat(loc.latitude);
            longitude = parseFloat(loc.longitude);
            console.log(`Found coordinates directly: ${latitude}, ${longitude}`);
          }
          // 2. Check for lat/lng properties (different naming)
          else if (loc.lat !== undefined && loc.lng !== undefined) {
            latitude = parseFloat(loc.lat);
            longitude = parseFloat(loc.lng);
            console.log(`Found coordinates (lat/lng): ${latitude}, ${longitude}`);
          }
          // 3. Check for coordinates array [lng, lat] (GeoJSON format)
          else if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
            longitude = parseFloat(loc.coordinates[0]);
            latitude = parseFloat(loc.coordinates[1]);
            console.log(`Found coordinates array (GeoJSON): ${latitude}, ${longitude}`);
          }
          // 4. Check for location property that contains coordinates
          else if (loc.location && typeof loc.location === 'object') {
            if (loc.location.latitude !== undefined && loc.location.longitude !== undefined) {
              latitude = parseFloat(loc.location.latitude);
              longitude = parseFloat(loc.location.longitude);
              console.log(`Found coordinates in location object: ${latitude}, ${longitude}`);
            } else if (loc.location.lat !== undefined && loc.location.lng !== undefined) {
              latitude = parseFloat(loc.location.lat);
              longitude = parseFloat(loc.location.lng);
              console.log(`Found coordinates in location object (lat/lng): ${latitude}, ${longitude}`);
            }
          }
          // 5. Check for geometry object (GeoJSON style)
          else if (loc.geometry && loc.geometry.coordinates && Array.isArray(loc.geometry.coordinates)) {
            if (loc.geometry.coordinates.length >= 2) {
              longitude = parseFloat(loc.geometry.coordinates[0]);
              latitude = parseFloat(loc.geometry.coordinates[1]);
              console.log(`Found coordinates in geometry: ${latitude}, ${longitude}`);
            }
          }
          // 6. Check for place object with location
          else if (loc.place && typeof loc.place === 'object') {
            if (loc.place.location && typeof loc.place.location === 'object') {
              if (loc.place.location.lat !== undefined && loc.place.location.lng !== undefined) {
                latitude = parseFloat(loc.place.location.lat);
                longitude = parseFloat(loc.place.location.lng);
                console.log(`Found coordinates in place.location: ${latitude}, ${longitude}`);
              }
            }
          }
          // 7. Check for value property containing location data
          else if (loc.value && typeof loc.value === 'object') {
            if (loc.value.latitude !== undefined && loc.value.longitude !== undefined) {
              latitude = parseFloat(loc.value.latitude);
              longitude = parseFloat(loc.value.longitude);
              console.log(`Found coordinates in value object: ${latitude}, ${longitude}`);
            } else if (loc.value.lat !== undefined && loc.value.lng !== undefined) {
              latitude = parseFloat(loc.value.lat);
              longitude = parseFloat(loc.value.lng);
              console.log(`Found coordinates in value object (lat/lng): ${latitude}, ${longitude}`);
            } else if (loc.value.location && typeof loc.value.location === 'object') {
              if (loc.value.location.latitude !== undefined && loc.value.location.longitude !== undefined) {
                latitude = parseFloat(loc.value.location.latitude);
                longitude = parseFloat(loc.value.location.longitude);
                console.log(`Found coordinates in value.location: ${latitude}, ${longitude}`);
              }
            }
          }
          
          // Build address from various possible fields
          const addressParts = [];
          
          // Check different possible address field structures
          if (loc.formatted_address) {
            address = loc.formatted_address;
          } else if (loc.address) {
            address = loc.address;
          } else if (loc.value && loc.value.formatted_address) {
            address = loc.value.formatted_address;
          } else if (loc.value && loc.value.address) {
            address = loc.value.address;
          } else if (loc.location_address || loc.location_city || loc.location_state) {
            // Original format support
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
              console.log(`Found coordinates in location_ fields: ${latitude}, ${longitude}`);
            }
          } else {
            // Try to build address from components
            const possibleFields = [
              loc.street_address, loc.streetAddress, loc.street,
              loc.location_address, loc.address1, loc.address_1,
              loc.value?.street_address, loc.value?.address
            ];
            
            const streetAddress = possibleFields.find(field => field && field.trim() !== '');
            if (streetAddress) addressParts.push(streetAddress);
            
            // Add address line 2 if exists
            const address2Fields = [
              loc.address2, loc.address_2, loc.location_address2,
              loc.value?.address2
            ];
            const address2 = address2Fields.find(field => field && field.trim() !== '');
            if (address2) addressParts.push(address2);
            
            // Add city
            const cityFields = [
              loc.city, loc.location_city, loc.locality,
              loc.value?.city, loc.value?.locality
            ];
            const city = cityFields.find(field => field && field.trim() !== '');
            if (city) addressParts.push(city);
            
            // Add state
            const stateFields = [
              loc.state, loc.location_state, loc.region,
              loc.value?.state, loc.value?.region
            ];
            const state = stateFields.find(field => field && field.trim() !== '');
            if (state) addressParts.push(state);
            
            // Add postal code
            const zipFields = [
              loc.postal_code, loc.postalCode, loc.zip,
              loc.location_zip, loc.value?.postal_code
            ];
            const zip = zipFields.find(field => field && field.trim() !== '');
            if (zip) addressParts.push(zip);
            
            // Add country
            const countryFields = [
              loc.country, loc.location_country,
              loc.value?.country
            ];
            const country = countryFields.find(field => field && field.trim() !== '');
            if (country) addressParts.push(country);
            
            address = addressParts.filter(part => part).join(', ');
          }
        }
        // If location is a string (might be just an address)
        else if (typeof loc === 'string') {
          address = loc;
          // Try to extract coordinates if they're embedded in the string
          const coordMatch = loc.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
          if (coordMatch && coordMatch.length === 3) {
            latitude = parseFloat(coordMatch[1]);
            longitude = parseFloat(coordMatch[2]);
            console.log(`Extracted coordinates from string: ${latitude}, ${longitude}`);
          }
        }
      }
      
      // Validate coordinates
      if (latitude !== null && longitude !== null) {
        // Check if coordinates are valid (within reasonable bounds)
        if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          console.warn(`Invalid coordinates detected: ${latitude}, ${longitude} - resetting to null`);
          latitude = null;
          longitude = null;
        } else if (isNaN(latitude) || isNaN(longitude)) {
          console.warn(`NaN coordinates detected: ${latitude}, ${longitude} - resetting to null`);
          latitude = null;
          longitude = null;
        }
      }
      
      // If we still don't have coordinates but have an address, log it
      if ((!latitude || !longitude) && address) {
        console.log(`No coordinates for address: ${address}`);
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
    
    // Log the first transformed record
    if (transformedData.length > 0) {
      console.log('Sample transformed record:', transformedData[0]);
    }
    
    // Log how many records have valid coordinates BEFORE geocoding
    const validCoordinatesBeforeGeocoding = transformedData.filter(item => 
      item.Latitude && item.Longitude && 
      !isNaN(item.Latitude) && !isNaN(item.Longitude)
    ).length;
    
    console.log(`Found ${validCoordinatesBeforeGeocoding} records with valid coordinates from SmartSuite`);
    
    // If we have records without coordinates, attempt to geocode them
    const recordsWithoutCoordinates = transformedData.filter(item => 
      (!item.Latitude || !item.Longitude) && item.Address
    );
    
    if (recordsWithoutCoordinates.length > 0) {
      console.log(`Found ${recordsWithoutCoordinates.length} records without coordinates but with addresses`);
      
      // Only geocode a limited number to avoid rate limits
      const MAX_GEOCODE = 20; // Adjust based on your needs
      if (recordsWithoutCoordinates.length > MAX_GEOCODE) {
        console.log(`Limiting geocoding to first ${MAX_GEOCODE} records to avoid rate limits`);
        await geocodeAddressesForRecords(recordsWithoutCoordinates.slice(0, MAX_GEOCODE));
      } else {
        await geocodeAddressesForRecords(recordsWithoutCoordinates);
      }
    }
    
    // Log how many records have valid coordinates AFTER geocoding
    const validCoordinatesAfterGeocoding = transformedData.filter(item => 
      item.Latitude && item.Longitude && 
      !isNaN(item.Latitude) && !isNaN(item.Longitude)
    ).length;
    
    console.log(`After geocoding: ${validCoordinatesAfterGeocoding} records with valid coordinates out of ${transformedData.length} total records`);
    
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
  
  console.log(`Calculating city distribution for ${leads.length} leads`);
  
  leads.forEach((lead, index) => {
    if (lead.Address) {
      // Extract city from address
      const addressParts = lead.Address.split(',').map(part => part.trim());
      
      console.log(`  Processing address: "${lead.Address}" (${addressParts.length} parts)`);
      
      if (addressParts.length >= 2) {
        let cityName = '';
        
        // Check if first part is a city by seeing if second part is a state
        const firstPart = addressParts[0];
        const secondPart = addressParts[1];
        
        // If the second part is a state, then first part is likely the city
        if (stateNames.has(secondPart.toLowerCase()) || 
            Object.keys(stateFullNames).some(abbr => secondPart.toUpperCase() === abbr)) {
          cityName = firstPart;
          console.log(`    Detected city from first part: "${cityName}"`);
        } else if (addressParts.length >= 3) {
          // Otherwise, for longer addresses, city is usually second part
          cityName = secondPart;
          console.log(`    Detected city from second part: "${cityName}"`);
        } else {
          // For 2-part addresses where second isn't a state, assume first is city
          cityName = firstPart;
          console.log(`    Defaulting to first part as city: "${cityName}"`);
        }
        
        // Store original for debugging
        const originalCityName = cityName;
        
        // Clean up city name - remove numbers, extra spaces, and common prefixes
        cityName = cityName.replace(/^\d+\s+/, '') // Remove leading numbers
                          .replace(/\s+/g, ' ')    // Normalize spaces
                          .trim();
        
        // Remove "County" from city names (e.g., "New Castle County" -> "New Castle")
        if (cityName.toLowerCase().endsWith(' county')) {
          cityName = cityName.substring(0, cityName.length - 7).trim();
          console.log(`    Removed "County": "${originalCityName}" -> "${cityName}"`);
        }
        
        // Skip if this is a state name
        if (stateNames.has(cityName.toLowerCase())) {
          console.log(`    Skipping state name: ${cityName}`);
          return; // Skip this iteration
        }
        
        // Skip if this is "United States" or a country name
        if (cityName.toLowerCase() === 'united states' || 
            cityName.toLowerCase() === 'usa' ||
            cityName.toLowerCase() === 'us') {
          console.log(`    Skipping country name: ${cityName}`);
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
          
          console.log(`    Final city name: "${cityName}"`);
          
          cityCounts[cityName] = (cityCounts[cityName] || 0) + 1;
        } else {
          console.log(`    Filtered out: "${cityName}"`);
        }
      }
    }
  });
  
  // Debug: Log final city counts
  console.log('Final city counts:');
  Object.entries(cityCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`);
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
    },
    geocoding_service: 'Photon (Komoot) - Free API'
  };
  
  res.json(status);
});

// Debug route to test geocoding on server
app.get('/debug/geocoding', async (req, res) => {
  const { city } = req.query;
  
  if (!city) {
    return res.json({ error: 'Please provide a city parameter' });
  }
  
  try {
    console.log(`Testing geocoding for: ${city}`);
    const result = await geocodeCity(city);
    
    res.json({
      success: !!result,
      city: city,
      result: result,
      cache_size: Object.keys(geocodingCache).length,
      environment: {
        node_env: process.env.NODE_ENV,
        geocoding_service: 'Photon (Komoot)'
      }
    });
  } catch (error) {
    res.json({
      success: false,
      city: city,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test geocoding directly
app.get('/test-geocoding', async (req, res) => {
  const city = req.query.city || 'trenton';
  
  console.log(`Testing geocoding for: ${city}`);
  
  try {
    // Test Photon API directly
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(city + ', USA')}&limit=1&lang=en`;
    console.log(`Calling Photon API: ${photonUrl}`);
    
    const response = await axios.get(photonUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'LocationLeadDashboard/1.0',
        'Accept': 'application/json'
      }
    });
    
    console.log('Photon response status:', response.status);
    console.log('Photon response data:', JSON.stringify(response.data, null, 2));
    
    // Also test your geocodeCity function
    const geocodeResult = await geocodeCity(city);
    
    res.json({
      city: city,
      photonApiUrl: photonUrl,
      photonRawResponse: response.data,
      geocodeCityResult: geocodeResult,
      cacheSize: Object.keys(geocodingCache).length,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version
    });
    
  } catch (error) {
    console.error('Test geocoding error:', error);
    res.json({
      city: city,
      error: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response'
    });
  }
});

// Debug route to check lead coordinates in a specific area
app.get('/debug/leads-near', ensureDataLoaded, async (req, res) => {
  const { city, radius } = req.query;
  
  if (!city) {
    return res.json({ error: 'Please provide a city parameter' });
  }
  
  const searchRadius = parseFloat(radius) || 50;
  
  try {
    // Geocode the search city
    const cityCoordinates = await geocodeCity(city);
    
    if (!cityCoordinates) {
      return res.json({ 
        error: `Could not geocode city: ${city}`,
        city: city,
        radius: searchRadius
      });
    }
    
    // Find all leads with coordinates
    const leadsWithCoordinates = leadsData.filter(lead => 
      lead.Latitude && lead.Longitude && 
      !isNaN(lead.Latitude) && !isNaN(lead.Longitude)
    );
    
    // Calculate distances and find nearby leads
    const nearbyLeads = leadsWithCoordinates.map(lead => {
      const distance = calculateDistance(
        cityCoordinates.latitude,
        cityCoordinates.longitude,
        lead.Latitude,
        lead.Longitude
      );
      
      return {
        company: lead.Company,
        address: lead.Address,
        latitude: lead.Latitude,
        longitude: lead.Longitude,
        distance: distance.toFixed(2)
      };
    }).filter(lead => parseFloat(lead.distance) <= searchRadius)
      .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    
    // Also find leads in Pennsylvania (broader search)
    const paLeads = leadsData.filter(lead => {
      const address = lead.Address || '';
      return address.toLowerCase().includes('pennsylvania') || 
             address.toLowerCase().includes(', pa') ||
             address.toLowerCase().includes(', pa,');
    }).map(lead => ({
      company: lead.Company,
      address: lead.Address,
      latitude: lead.Latitude,
      longitude: lead.Longitude,
      hasCoordinates: !!(lead.Latitude && lead.Longitude)
    }));
    
    res.json({
      searchCity: city,
      searchRadius: searchRadius,
      cityCoordinates: cityCoordinates,
      totalLeads: leadsData.length,
      leadsWithCoordinates: leadsWithCoordinates.length,
      nearbyLeads: nearbyLeads,
      nearbyCount: nearbyLeads.length,
      paLeads: paLeads.slice(0, 20), // Show first 20 PA leads
      paLeadsTotal: paLeads.length,
      paLeadsWithCoordinates: paLeads.filter(l => l.hasCoordinates).length
    });
  } catch (error) {
    res.json({
      error: error.message,
      city: city,
      radius: searchRadius
    });
  }
});

// Debug route to see raw SmartSuite data structure
app.get('/debug/smartsuite-data', async (req, res) => {
  try {
    // Only allow in development or with a secret key
    const debugKey = req.query.key;
    if (debugKey !== 'debug-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get one record from SmartSuite to inspect structure
    const authHeader = `Token ${smartsuiteConfig.apiKey}`;
    const baseUrl = 'https://app.smartsuite.com/api/v1';
    
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'ACCOUNT-ID': smartsuiteConfig.accountId
    };
    
    const recordsUrl = `${baseUrl}/applications/${smartsuiteConfig.tableId}/records/list/`;
    
    const response = await axios({
      method: 'POST',
      url: recordsUrl,
      headers: headers,
      data: {
        sort: [],
        filter: {},
        hydrated: true,
        limit: 1 // Just get one record
      }
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const sampleRecord = response.data.items[0];
      
      // Specifically look at the location field
      const locationField = sampleRecord.s5d25b0846;
      
      res.json({
        success: true,
        message: 'Sample record structure',
        record: sampleRecord,
        locationField: locationField,
        locationFieldType: typeof locationField,
        locationFieldKeys: locationField && typeof locationField === 'object' ? Object.keys(locationField) : null
      });
    } else {
      res.json({
        success: false,
        message: 'No records found'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Also add a route to check current loaded data
app.get('/debug/current-data', (req, res) => {
  // Only allow in development or with a secret key
  const debugKey = req.query.key;
  if (debugKey !== 'debug-2025') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  const summary = {
    totalRecords: leadsData.length,
    recordsWithCoordinates: leadsData.filter(lead => 
      lead.Latitude && lead.Longitude && 
      !isNaN(lead.Latitude) && !isNaN(lead.Longitude)
    ).length,
    recordsWithoutCoordinates: leadsData.filter(lead => 
      !lead.Latitude || !lead.Longitude
    ).length,
    sampleRecords: leadsData.slice(0, 3).map(lead => ({
      company: lead.Company,
      address: lead.Address,
      latitude: lead.Latitude,
      longitude: lead.Longitude
    }))
  };
  
  res.json(summary);
});

// Main dashboard route
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
    searchTerm: null
  });
});

// State filter route
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
    
    // Debug: Log some sample addresses to see the format
    console.log(`Filtering for state: ${state}`);
    console.log(`Found ${filteredLeads.length} leads in ${state}`);
    if (filteredLeads.length > 0) {
      console.log('Sample addresses:');
      filteredLeads.slice(0, 5).forEach((lead, index) => {
        console.log(`  ${index + 1}. ${lead.Address}`);
      });
    }
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
  
  // Debug: Log city counts
  if (state && state !== 'All States') {
    console.log('City counts for', state + ':');
    const sortedCities = Object.entries(dashboardMetrics.cityCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    sortedCities.forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`);
    });
  }
  
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
    searchTerm: null
  });
});

// Company search route
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
    searchTerm: company // Pass the search term to the template
  });
});

// City search route with enhanced debugging
app.get('/city-search', ensureDataLoaded, async (req, res) => {
  const { city, radius } = req.query;
  
  console.log('=== CITY SEARCH DEBUG ===');
  console.log('Query params:', { city, radius });
  console.log('Total leads in memory:', leadsData.length);
  console.log('Leads with coordinates:', leadsData.filter(l => l.Latitude && l.Longitude).length);
  
  if (!city || city.trim() === '') {
    console.log('No city provided, redirecting to home');
    return res.redirect('/');
  }
  
  // Convert radius to number, default to 50 miles if invalid
  const searchRadius = parseFloat(radius) || 50;
  
  try {
    // Geocode the city to get coordinates
    console.log('Geocoding city:', city);
    const cityCoordinates = await geocodeCity(city);
    console.log('Geocoding result:', cityCoordinates);
    
    if (!cityCoordinates) {
      console.log('Geocoding failed for city:', city);
      // If geocoding fails, render with error message
      const states = Object.values(stateFullNames).sort();
      
      // Calculate basic metrics with all leads since we can't filter
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
        citySearchError: `Could not find coordinates for "${city}". Please try a different city name.`
      });
    }
    
    // Log sample leads to see their coordinate format
    console.log('Sample leads with coordinates:');
    leadsData.filter(l => l.Latitude && l.Longitude).slice(0, 3).forEach(lead => {
      console.log({
        company: lead.Company,
        lat: lead.Latitude,
        lng: lead.Longitude,
        latType: typeof lead.Latitude,
        lngType: typeof lead.Longitude
      });
    });
    
    // Filter leads within the specified radius - create copies to avoid modifying original data
    const filteredLeads = leadsData.filter(lead => {
      // Skip leads without coordinates
      if (!lead.Latitude || !lead.Longitude || isNaN(lead.Latitude) || isNaN(lead.Longitude)) {
        return false;
      }
      
      // Calculate distance
      const distance = calculateDistance(
        cityCoordinates.latitude,
        cityCoordinates.longitude,
        lead.Latitude,
        lead.Longitude
      );
      
      // Include if within radius
      return distance <= searchRadius;
    }).map(lead => {
      // Create a copy of the lead with distance property
      const distance = calculateDistance(
        cityCoordinates.latitude,
        cityCoordinates.longitude,
        lead.Latitude,
        lead.Longitude
      );
      
      return {
        ...lead,
        distance: distance.toFixed(1)
      };
    });
    
    console.log('Filtered leads count:', filteredLeads.length);
    console.log('=== END CITY SEARCH DEBUG ===');
    
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
      citySearchCoordinates: cityCoordinates
    });
  } catch (error) {
    console.error('City search error:', error);
    console.error('Stack trace:', error.stack);
    // If there's an error, redirect to the home page
    res.redirect('/');
  }
});

// Route to manually refresh data
app.post('/refresh-data', async (req, res) => {
  try {
    leadsData = await loadSmartSuiteData();
    res.json({ success: true, message: 'Data refreshed successfully!' });
  } catch (error) {
    console.error('Error refreshing data:', error);
    res.status(500).json({ success: false, message: `Error refreshing data: ${error.message}` });
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
  console.log(`Geocoding Service: Photon (Komoot) - Free, no API key required`);
});
