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

// Geocoding cache and utilities for city search
const geocodingCache = {}; // Simple cache to avoid repeated API calls

// Geocoding function using OpenStreetMap Nominatim API
async function geocodeCity(cityName) {
  // Check cache first
  if (geocodingCache[cityName]) {
    return geocodingCache[cityName];
  }
  
  try {
    // Using OpenStreetMap Nominatim API for geocoding (free and open source)
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: cityName,
        format: 'json',
        limit: 1,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'LocationLeadDashboard/1.0' // Required by Nominatim ToS
      }
    });
    
    if (response.data && response.data.length > 0) {
      const result = {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon),
        displayName: response.data[0].display_name
      };
      
      // Cache the result
      geocodingCache[cityName] = result;
      return result;
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
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

// SmartSuite API configuration
const smartsuiteConfig = {
  apiKey: 'c5f0367be5ffdc0f0ff804d8bfc1647b3d9abe38',
  appId: '67c735724878712509589af7',
  tableId: '67c8fdfb508eb94c4784fb95',
  accountId: 'sxs77u60'
};

// Load data from SmartSuite API with enhanced debugging and updated endpoint
async function loadSmartSuiteData() {
  if (!smartsuiteConfig.apiKey || !smartsuiteConfig.tableId) {
    console.log('SmartSuite configuration incomplete');
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
      'ACCOUNT-ID': smartsuiteConfig.accountId
    };
    
    // Try a simple request to the base API endpoint first
    console.log('Attempting direct API connection test...');
    try {
      const testResponse = await axios({
        method: 'GET',
        url: baseUrl,
        headers: headers
      });
      console.log('Base API endpoint accessible:', testResponse.status);
    } catch (testError) {
      console.error('Base API test failed:', testError.message);
      if (testError.response) {
        console.error('Status:', testError.response.status);
        console.error('Data:', testError.response.data);
      }
      return []; // If we can't connect to the base API, no need to continue
    }
    
    // List applications to find available ones
    console.log('Attempting to list all applications...');
    try {
      const appsResponse = await axios({
        method: 'GET',
        url: `${baseUrl}/applications/`,
        headers: headers
      });
      
      console.log('Applications list accessible.');
      if (appsResponse.data && appsResponse.data.items) {
        console.log(`Found ${appsResponse.data.items.length} applications.`);
        console.log('Available applications:');
        appsResponse.data.items.forEach(app => {
          console.log(`- ID: ${app.id}, Name: ${app.name}`);
        });
        
        // Check if our configured tableId exists in the response
        const appExists = appsResponse.data.items.some(app => app.id === smartsuiteConfig.tableId);
        if (appExists) {
          console.log(`Found matching application ID: ${smartsuiteConfig.tableId}`);
        } else {
          console.warn(`WARNING: Configured tableId '${smartsuiteConfig.tableId}' was not found in the list of applications.`);
        }
      }
    } catch (appsError) {
      console.error('Error listing applications:', appsError.message);
      if (appsError.response) {
        console.error('Status:', appsError.response.status);
        console.error('Data:', appsError.response.data);
      }
    }
    
    // Now use the CORRECT endpoint for listing records according to the documentation
    // The documentation shows we need to use POST to /applications/[tableId]/records/list/
    console.log('Using correct records list endpoint with POST method...');
    
    // According to the documentation, tableId is used directly with applications
    const recordsUrl = `${baseUrl}/applications/${smartsuiteConfig.tableId}/records/list/`;
    console.log('Using records URL:', recordsUrl);
    
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
      data: requestBody
    });

    console.log('Successfully fetched records!');
    
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

    // Transform the data to match the expected format with the correct field mappings
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
            console.log(`Found coordinates: ${latitude}, ${longitude}`);
          }
        } 
        // Try alternate format with lat/lng directly in the object
        else if (loc.latitude !== undefined && loc.longitude !== undefined) {
          latitude = parseFloat(loc.latitude);
          longitude = parseFloat(loc.longitude);
          console.log(`Found coordinates in alternate format: ${latitude}, ${longitude}`);
          
          // Try to build address from available fields
          const addressParts = [];
          if (loc.address) addressParts.push(loc.address);
          if (loc.city) addressParts.push(loc.city);
          if (loc.state) addressParts.push(loc.state);
          if (loc.zip) addressParts.push(loc.zip);
          if (loc.country) addressParts.push(loc.country);
          
          address = addressParts.join(', ');
        }
        // If location is a string with embedded coordinates
        else if (typeof loc === 'string' && loc.includes(',')) {
          address = loc;
          // Try to extract coordinates from string format like "lat,lng"
          const parts = loc.split(',').map(part => part.trim());
          if (parts.length >= 2) {
            const potentialLat = parseFloat(parts[0]);
            const potentialLng = parseFloat(parts[1]);
            if (!isNaN(potentialLat) && !isNaN(potentialLng)) {
              latitude = potentialLat;
              longitude = potentialLng;
              console.log(`Extracted coordinates from string: ${latitude}, ${longitude}`);
            }
          }
        }
        // If we have a value property that contains lat/lng
        else if (loc.value && typeof loc.value === 'object') {
          if (loc.value.latitude !== undefined && loc.value.longitude !== undefined) {
            latitude = parseFloat(loc.value.latitude);
            longitude = parseFloat(loc.value.longitude);
            console.log(`Found coordinates in value object: ${latitude}, ${longitude}`);
          }
          
          // Try to build address from value object
          if (loc.value.formatted_address) {
            address = loc.value.formatted_address;
          }
        }
      }
      
      // ATTEMPT TO GEOCODE FROM ADDRESS IF NO COORDINATES FOUND
      // This is a simplified example - for production, you would use a real geocoding service
      if (!latitude || !longitude) {
        // Check if we can extract coordinates from an address that might contain them
        if (address && typeof address === 'string') {
          // Look for patterns like "123 Main St, City, ST 12345 (40.123, -74.456)"
          const coordMatch = address.match(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
          if (coordMatch && coordMatch.length === 3) {
            latitude = parseFloat(coordMatch[1]);
            longitude = parseFloat(coordMatch[2]);
            console.log(`Extracted coordinates from address string: ${latitude}, ${longitude}`);
          }
        }
        
        // Additional fallback for specific states - add approximate coordinates
        // This is just a simple fallback example
        if (!latitude && !longitude && address) {
          // Check for state names in the address and assign approximate center coordinates
          Object.entries(stateFullNames).forEach(([abbr, fullName]) => {
            if (address.includes(fullName) || address.includes(`, ${abbr},`)) {
              // These are very approximate center points for states - replace with accurate data
              const stateCoords = {
                'AL': [32.806671, -86.791130], 'AK': [61.370716, -152.404419], 'AZ': [33.729759, -111.431221],
                'AR': [34.969704, -92.373123], 'CA': [36.116203, -119.681564], 'CO': [39.059811, -105.311104],
                'CT': [41.597782, -72.755371], 'DE': [39.318523, -75.507141], 'FL': [27.766279, -81.686783],
                'GA': [33.040619, -83.643074], 'HI': [21.094318, -157.498337], 'ID': [44.240459, -114.478828],
                'IL': [40.349457, -88.986137], 'IN': [39.849426, -86.258278], 'IA': [42.011539, -93.210526],
                'KS': [38.526600, -96.726486], 'KY': [37.668140, -84.670067], 'LA': [31.169546, -91.867805],
                'ME': [44.693947, -69.381927], 'MD': [39.063946, -76.802101], 'MA': [42.230171, -71.530106],
                'MI': [43.326618, -84.536095], 'MN': [45.694454, -93.900192], 'MS': [32.741646, -89.678696],
                'MO': [38.456085, -92.288368], 'MT': [46.921925, -110.454353], 'NE': [41.125370, -98.268082],
                'NV': [38.313515, -117.055374], 'NH': [43.452492, -71.563896], 'NJ': [40.298904, -74.521011],
                'NM': [34.840515, -106.248482], 'NY': [42.165726, -74.948051], 'NC': [35.630066, -79.806419],
                'ND': [47.528912, -99.784012], 'OH': [40.388783, -82.764915], 'OK': [35.565342, -96.928917],
                'OR': [44.572021, -122.070938], 'PA': [40.590752, -77.209755], 'RI': [41.680893, -71.511780],
                'SC': [33.856892, -80.945007], 'SD': [44.299782, -99.438828], 'TN': [35.747845, -86.692345],
                'TX': [31.054487, -97.563461], 'UT': [40.150032, -111.862434], 'VT': [44.045876, -72.710686],
                'VA': [37.769337, -78.169968], 'WA': [47.400902, -121.490494], 'WV': [38.491226, -80.954453],
                'WI': [44.268543, -89.616508], 'WY': [42.755966, -107.302490]
              };
              
              if (stateCoords[abbr]) {
                [latitude, longitude] = stateCoords[abbr];
                console.log(`Using approximate coordinates for state ${fullName}: ${latitude}, ${longitude}`);
              }
            }
          });
        }
      }   
      
      // Extract the new fields for multi-select fields
      let siteType = '';
      let specializedIndustrySite = '';
      let onetIndustrySite = '';

      // Site Type field - using s91e2ac54c (confirmed)
      if (item.s91e2ac54c) {
        if (Array.isArray(item.s91e2ac54c)) {
          // Handle array of selected values
          siteType = item.s91e2ac54c.map(val => val.label || val).join(', ');
        } else if (typeof item.s91e2ac54c === 'object' && item.s91e2ac54c.label) {
          // Handle single selected value with label
          siteType = item.s91e2ac54c.label;
        } else if (typeof item.s91e2ac54c === 'object' && item.s91e2ac54c.values) {
          // Handle values property
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
          // Handle array of selected values
          specializedIndustrySite = item.s21hlm59.map(val => val.label || val).join(', ');
        } else if (typeof item.s21hlm59 === 'object' && item.s21hlm59.label) {
          // Handle single selected value with label
          specializedIndustrySite = item.s21hlm59.label;
        } else if (typeof item.s21hlm59 === 'object' && item.s21hlm59.values) {
          // Handle values property
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
          // Handle array of selected values
          onetIndustrySite = item.s5530473fb.map(val => val.label || val).join(', ');
        } else if (typeof item.s5530473fb === 'object' && item.s5530473fb.label) {
          // Handle single selected value with label
          onetIndustrySite = item.s5530473fb.label;
        } else if (typeof item.s5530473fb === 'object' && item.s5530473fb.values) {
          // Handle values property
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
        // Add the new fields
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
    
    // Log how many records have valid coordinates
    const validCoordinates = transformedData.filter(item => 
      item.Latitude && item.Longitude && 
      !isNaN(item.Latitude) && !isNaN(item.Longitude)
    ).length;
    
    console.log(`Found ${validCoordinates} records with valid coordinates out of ${transformedData.length} total records`);
    
    return transformedData;
  } catch (error) {
    console.error('Error fetching data from SmartSuite API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return [];
  }
}

// Initialize data on startup
(async function() {
  try {
    // Load the data from SmartSuite
    if (smartsuiteConfig.apiKey) {
      leadsData = await loadSmartSuiteData();
    }
  } catch (error) {
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

// Main dashboard route
app.get('/', (req, res) => {
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
app.get('/filter', (req, res) => {
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
app.get('/search', (req, res) => {
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

// City search route
app.get('/city-search', async (req, res) => {
  const { city, radius } = req.query;
  
  if (!city || city.trim() === '') {
    return res.redirect('/');
  }
  
  // Convert radius to number, default to 50 miles if invalid
  const searchRadius = parseFloat(radius) || 50;
  
  try {
    // Geocode the city to get coordinates
    const cityCoordinates = await geocodeCity(city);
    
    if (!cityCoordinates) {
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
app.get('/api/dashboard-data', (req, res) => {
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
});
