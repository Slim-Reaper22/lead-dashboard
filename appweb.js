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

// Enhanced geocoding function with better error handling and fallbacks
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
    
    // Try multiple geocoding services
    const geocodingServices = [
      // Primary: OpenStreetMap Nominatim
      {
        name: 'Nominatim',
        url: 'https://nominatim.openstreetmap.org/search',
        params: {
          q: cityName,
          format: 'json',
          limit: 1,
          addressdetails: 1,
          countrycodes: 'us' // Limit to US for better results
        },
        headers: {
          'User-Agent': 'LocationLeadDashboard/1.0 (contact@encodeset.com)'
        },
        parseResponse: (data) => {
          if (data && data.length > 0) {
            return {
              latitude: parseFloat(data[0].lat),
              longitude: parseFloat(data[0].lon),
              displayName: data[0].display_name
            };
          }
          return null;
        }
      },
      // Fallback: Try with different query format
      {
        name: 'Nominatim-Formatted',
        url: 'https://nominatim.openstreetmap.org/search',
        params: {
          q: `${cityName}, United States`,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'LocationLeadDashboard/1.0 (contact@encodeset.com)'
        },
        parseResponse: (data) => {
          if (data && data.length > 0) {
            return {
              latitude: parseFloat(data[0].lat),
              longitude: parseFloat(data[0].lon),
              displayName: data[0].display_name
            };
          }
          return null;
        }
      }
    ];
    
    // Try each service
    for (const service of geocodingServices) {
      try {
        console.log(`Trying ${service.name} for: ${cityName}`);
        
        const response = await axios.get(service.url, {
          params: service.params,
          headers: service.headers,
          timeout: 10000 // 10 second timeout
        });
        
        console.log(`${service.name} response status:`, response.status);
        console.log(`${service.name} response data:`, response.data);
        
        const result = service.parseResponse(response.data);
        
        if (result) {
          console.log(`Successfully geocoded ${cityName} using ${service.name}:`, result);
          // Cache the result
          geocodingCache[cityName] = result;
          return result;
        } else {
          console.log(`No results from ${service.name} for: ${cityName}`);
        }
        
        // Add delay between service attempts
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (serviceError) {
        console.error(`Error with ${service.name}:`, serviceError.message);
        if (serviceError.response) {
          console.error(`${service.name} response status:`, serviceError.response.status);
          console.error(`${service.name} response data:`, serviceError.response.data);
        }
        continue; // Try next service
      }
    }
    
    // If all services fail, try a hardcoded fallback for common cities
    const commonCities = {
      'philadelphia': { latitude: 39.9526, longitude: -75.1652, displayName: 'Philadelphia, PA, USA' },
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
      'arlington': { latitude: 32.7357, longitude: -97.1081, displayName: 'Arlington, TX, USA' },
      'new orleans': { latitude: 29.9511, longitude: -90.0715, displayName: 'New Orleans, LA, USA' },
      'bakersfield': { latitude: 35.3733, longitude: -119.0187, displayName: 'Bakersfield, CA, USA' },
      'tampa': { latitude: 27.9506, longitude: -82.4572, displayName: 'Tampa, FL, USA' },
      'honolulu': { latitude: 21.3099, longitude: -157.8581, displayName: 'Honolulu, HI, USA' },
      'anaheim': { latitude: 33.8366, longitude: -117.9143, displayName: 'Anaheim, CA, USA' },
      'aurora': { latitude: 39.7294, longitude: -104.8319, displayName: 'Aurora, CO, USA' },
      'santa ana': { latitude: 33.7455, longitude: -117.8677, displayName: 'Santa Ana, CA, USA' },
      'st. louis': { latitude: 38.6270, longitude: -90.1994, displayName: 'St. Louis, MO, USA' },
      'riverside': { latitude: 33.9533, longitude: -117.3962, displayName: 'Riverside, CA, USA' },
      'corpus christi': { latitude: 27.8006, longitude: -97.3964, displayName: 'Corpus Christi, TX, USA' },
      'lexington': { latitude: 38.0406, longitude: -84.5037, displayName: 'Lexington, KY, USA' },
      'pittsburgh': { latitude: 40.4406, longitude: -79.9959, displayName: 'Pittsburgh, PA, USA' },
      'anchorage': { latitude: 61.2181, longitude: -149.9003, displayName: 'Anchorage, AK, USA' },
      'stockton': { latitude: 37.9577, longitude: -121.2908, displayName: 'Stockton, CA, USA' },
      'cincinnati': { latitude: 39.1031, longitude: -84.5120, displayName: 'Cincinnati, OH, USA' },
      'st. paul': { latitude: 44.9537, longitude: -93.0900, displayName: 'St. Paul, MN, USA' },
      'toledo': { latitude: 41.6528, longitude: -83.5379, displayName: 'Toledo, OH, USA' },
      'newark': { latitude: 40.7357, longitude: -74.1724, displayName: 'Newark, NJ, USA' },
      'greensboro': { latitude: 36.0726, longitude: -79.7920, displayName: 'Greensboro, NC, USA' },
      'plano': { latitude: 33.0198, longitude: -96.6989, displayName: 'Plano, TX, USA' },
      'henderson': { latitude: 36.0395, longitude: -114.9817, displayName: 'Henderson, NV, USA' },
      'lincoln': { latitude: 40.8136, longitude: -96.7026, displayName: 'Lincoln, NE, USA' },
      'buffalo': { latitude: 42.8864, longitude: -78.8784, displayName: 'Buffalo, NY, USA' },
      'jersey city': { latitude: 40.7178, longitude: -74.0431, displayName: 'Jersey City, NJ, USA' },
      'chula vista': { latitude: 32.6401, longitude: -117.0842, displayName: 'Chula Vista, CA, USA' },
      'fort wayne': { latitude: 41.0793, longitude: -85.1394, displayName: 'Fort Wayne, IN, USA' },
      'orlando': { latitude: 28.5383, longitude: -81.3792, displayName: 'Orlando, FL, USA' },
      'st. petersburg': { latitude: 27.7676, longitude: -82.6403, displayName: 'St. Petersburg, FL, USA' },
      'chandler': { latitude: 33.3062, longitude: -111.8413, displayName: 'Chandler, AZ, USA' },
      'laredo': { latitude: 27.5106, longitude: -99.5075, displayName: 'Laredo, TX, USA' },
      'norfolk': { latitude: 36.8508, longitude: -76.2859, displayName: 'Norfolk, VA, USA' },
      'durham': { latitude: 35.9940, longitude: -78.8986, displayName: 'Durham, NC, USA' },
      'madison': { latitude: 43.0731, longitude: -89.4012, displayName: 'Madison, WI, USA' },
      'lubbock': { latitude: 33.5779, longitude: -101.8552, displayName: 'Lubbock, TX, USA' },
      'irvine': { latitude: 33.6846, longitude: -117.8265, displayName: 'Irvine, CA, USA' },
      'winston-salem': { latitude: 36.0999, longitude: -80.2442, displayName: 'Winston-Salem, NC, USA' },
      'glendale': { latitude: 33.5387, longitude: -112.1860, displayName: 'Glendale, AZ, USA' },
      'garland': { latitude: 32.9126, longitude: -96.6389, displayName: 'Garland, TX, USA' },
      'hialeah': { latitude: 25.8576, longitude: -80.2781, displayName: 'Hialeah, FL, USA' },
      'reno': { latitude: 39.5296, longitude: -119.8138, displayName: 'Reno, NV, USA' },
      'chesapeake': { latitude: 36.8190, longitude: -76.2750, displayName: 'Chesapeake, VA, USA' },
      'gilbert': { latitude: 33.3528, longitude: -111.7890, displayName: 'Gilbert, AZ, USA' },
      'baton rouge': { latitude: 30.4515, longitude: -91.1871, displayName: 'Baton Rouge, LA, USA' },
      'irving': { latitude: 32.8140, longitude: -96.9489, displayName: 'Irving, TX, USA' },
      'scottsdale': { latitude: 33.4942, longitude: -111.9261, displayName: 'Scottsdale, AZ, USA' },
      'north las vegas': { latitude: 36.1989, longitude: -115.1175, displayName: 'North Las Vegas, NV, USA' },
      'fremont': { latitude: 37.5485, longitude: -121.9886, displayName: 'Fremont, CA, USA' },
      'boise': { latitude: 43.6150, longitude: -116.2023, displayName: 'Boise, ID, USA' },
      'richmond': { latitude: 37.5407, longitude: -77.4360, displayName: 'Richmond, VA, USA' },
      'san bernardino': { latitude: 34.1083, longitude: -117.2898, displayName: 'San Bernardino, CA, USA' },
      'birmingham': { latitude: 33.5207, longitude: -86.8025, displayName: 'Birmingham, AL, USA' },
      'spokane': { latitude: 47.6587, longitude: -117.4260, displayName: 'Spokane, WA, USA' },
      'rochester': { latitude: 43.1566, longitude: -77.6088, displayName: 'Rochester, NY, USA' },
      'des moines': { latitude: 41.5868, longitude: -93.6250, displayName: 'Des Moines, IA, USA' },
      'modesto': { latitude: 37.6391, longitude: -120.9969, displayName: 'Modesto, CA, USA' },
      'fayetteville': { latitude: 35.0527, longitude: -78.8784, displayName: 'Fayetteville, NC, USA' },
      'tacoma': { latitude: 47.2529, longitude: -122.4443, displayName: 'Tacoma, WA, USA' },
      'oxnard': { latitude: 34.1975, longitude: -119.1771, displayName: 'Oxnard, CA, USA' },
      'fontana': { latitude: 34.0922, longitude: -117.4350, displayName: 'Fontana, CA, USA' },
      'montgomery': { latitude: 32.3668, longitude: -86.3000, displayName: 'Montgomery, AL, USA' },
      'moreno valley': { latitude: 33.9425, longitude: -117.2297, displayName: 'Moreno Valley, CA, USA' },
      'shreveport': { latitude: 32.5252, longitude: -93.7502, displayName: 'Shreveport, LA, USA' },
      'yonkers': { latitude: 40.9312, longitude: -73.8988, displayName: 'Yonkers, NY, USA' },
      'akron': { latitude: 41.0814, longitude: -81.5190, displayName: 'Akron, OH, USA' },
      'huntington beach': { latitude: 33.6595, longitude: -117.9988, displayName: 'Huntington Beach, CA, USA' },
      'little rock': { latitude: 34.7465, longitude: -92.2896, displayName: 'Little Rock, AR, USA' },
      'augusta': { latitude: 33.4735, longitude: -82.0105, displayName: 'Augusta, GA, USA' },
      'amarillo': { latitude: 35.2220, longitude: -101.8313, displayName: 'Amarillo, TX, USA' },
      'mobile': { latitude: 30.6954, longitude: -88.0399, displayName: 'Mobile, AL, USA' },
      'grand rapids': { latitude: 42.9634, longitude: -85.6681, displayName: 'Grand Rapids, MI, USA' },
      'salt lake city': { latitude: 40.7608, longitude: -111.8910, displayName: 'Salt Lake City, UT, USA' },
      'tallahassee': { latitude: 30.4518, longitude: -84.2807, displayName: 'Tallahassee, FL, USA' },
      'huntsville': { latitude: 34.7304, longitude: -86.5861, displayName: 'Huntsville, AL, USA' },
      'grand prairie': { latitude: 32.7460, longitude: -96.9978, displayName: 'Grand Prairie, TX, USA' },
      'knoxville': { latitude: 35.9606, longitude: -83.9207, displayName: 'Knoxville, TN, USA' },
      'worcester': { latitude: 42.2626, longitude: -71.8023, displayName: 'Worcester, MA, USA' },
      'newport news': { latitude: 37.0871, longitude: -76.4730, displayName: 'Newport News, VA, USA' },
      'brownsville': { latitude: 25.9018, longitude: -97.4975, displayName: 'Brownsville, TX, USA' },
      'overland park': { latitude: 38.9822, longitude: -94.6708, displayName: 'Overland Park, KS, USA' },
      'santa clarita': { latitude: 34.3917, longitude: -118.5426, displayName: 'Santa Clarita, CA, USA' },
      'providence': { latitude: 41.8240, longitude: -71.4128, displayName: 'Providence, RI, USA' },
      'garden grove': { latitude: 33.7739, longitude: -117.9415, displayName: 'Garden Grove, CA, USA' },
      'chattanooga': { latitude: 35.0456, longitude: -85.3097, displayName: 'Chattanooga, TN, USA' },
      'oceanside': { latitude: 33.1959, longitude: -117.3795, displayName: 'Oceanside, CA, USA' },
      'jackson': { latitude: 32.2988, longitude: -90.1848, displayName: 'Jackson, MS, USA' },
      'fort lauderdale': { latitude: 26.1224, longitude: -80.1373, displayName: 'Fort Lauderdale, FL, USA' },
      'santa rosa': { latitude: 38.4404, longitude: -122.7144, displayName: 'Santa Rosa, CA, USA' },
      'rancho cucamonga': { latitude: 34.1064, longitude: -117.5931, displayName: 'Rancho Cucamonga, CA, USA' },
      'port st. lucie': { latitude: 27.2939, longitude: -80.3501, displayName: 'Port St. Lucie, FL, USA' },
      'tempe': { latitude: 33.4255, longitude: -111.9400, displayName: 'Tempe, AZ, USA' },
      'ontario': { latitude: 34.0633, longitude: -117.6509, displayName: 'Ontario, CA, USA' },
      'vancouver': { latitude: 45.6387, longitude: -122.6615, displayName: 'Vancouver, WA, USA' },
      'cape coral': { latitude: 26.5629, longitude: -81.9495, displayName: 'Cape Coral, FL, USA' },
      'sioux falls': { latitude: 43.5446, longitude: -96.7311, displayName: 'Sioux Falls, SD, USA' },
      'springfield': { latitude: 37.2153, longitude: -93.2982, displayName: 'Springfield, MO, USA' },
      'peoria': { latitude: 40.6936, longitude: -89.5890, displayName: 'Peoria, IL, USA' },
      'pembroke pines': { latitude: 26.0073, longitude: -80.2962, displayName: 'Pembroke Pines, FL, USA' },
      'elk grove': { latitude: 38.4088, longitude: -121.3716, displayName: 'Elk Grove, CA, USA' },
      'salem': { latitude: 44.9429, longitude: -123.0351, displayName: 'Salem, OR, USA' },
      'lancaster': { latitude: 34.6868, longitude: -118.1542, displayName: 'Lancaster, CA, USA' },
      'corona': { latitude: 33.8753, longitude: -117.5664, displayName: 'Corona, CA, USA' },
      'eugene': { latitude: 44.0521, longitude: -123.0868, displayName: 'Eugene, OR, USA' },
      'palmdale': { latitude: 34.5794, longitude: -118.1165, displayName: 'Palmdale, CA, USA' },
      'salinas': { latitude: 36.6777, longitude: -121.6555, displayName: 'Salinas, CA, USA' },
      'pasadena': { latitude: 34.1478, longitude: -118.1445, displayName: 'Pasadena, CA, USA' },
      'fort collins': { latitude: 40.5853, longitude: -105.0844, displayName: 'Fort Collins, CO, USA' },
      'hayward': { latitude: 37.6688, longitude: -122.0808, displayName: 'Hayward, CA, USA' },
      'pomona': { latitude: 34.0552, longitude: -117.7500, displayName: 'Pomona, CA, USA' },
      'cary': { latitude: 35.7915, longitude: -78.7811, displayName: 'Cary, NC, USA' },
      'rockford': { latitude: 42.2711, longitude: -89.0940, displayName: 'Rockford, IL, USA' },
      'alexandria': { latitude: 38.8048, longitude: -77.0469, displayName: 'Alexandria, VA, USA' },
      'escondido': { latitude: 33.1192, longitude: -117.0864, displayName: 'Escondido, CA, USA' },
      'mckinney': { latitude: 33.1972, longitude: -96.6397, displayName: 'McKinney, TX, USA' },
      'joliet': { latitude: 41.5250, longitude: -88.0817, displayName: 'Joliet, IL, USA' },
      'sunnyvale': { latitude: 37.3688, longitude: -122.0363, displayName: 'Sunnyvale, CA, USA' },
      'torrance': { latitude: 33.8358, longitude: -118.3406, displayName: 'Torrance, CA, USA' },
      'bridgeport': { latitude: 41.1865, longitude: -73.1952, displayName: 'Bridgeport, CT, USA' },
      'lakewood': { latitude: 39.7047, longitude: -105.0814, displayName: 'Lakewood, CO, USA' },
      'hollywood': { latitude: 26.0112, longitude: -80.1495, displayName: 'Hollywood, FL, USA' },
      'paterson': { latitude: 40.9168, longitude: -74.1718, displayName: 'Paterson, NJ, USA' },
      'naperville': { latitude: 41.7508, longitude: -88.1535, displayName: 'Naperville, IL, USA' },
      'syracuse': { latitude: 43.0481, longitude: -76.1474, displayName: 'Syracuse, NY, USA' },
      'mesquite': { latitude: 32.7668, longitude: -96.5991, displayName: 'Mesquite, TX, USA' },
      'dayton': { latitude: 39.7589, longitude: -84.1916, displayName: 'Dayton, OH, USA' },
      'savannah': { latitude: 32.0835, longitude: -81.0998, displayName: 'Savannah, GA, USA' },
      'clarksville': { latitude: 36.5298, longitude: -87.3595, displayName: 'Clarksville, TN, USA' },
      'orange': { latitude: 33.7879, longitude: -117.8531, displayName: 'Orange, CA, USA' },
      'fullerton': { latitude: 33.8704, longitude: -117.9242, displayName: 'Fullerton, CA, USA' },
      'killeen': { latitude: 31.1171, longitude: -97.7278, displayName: 'Killeen, TX, USA' },
      'frisco': { latitude: 33.1507, longitude: -96.8236, displayName: 'Frisco, TX, USA' },
      'hampton': { latitude: 37.0299, longitude: -76.3452, displayName: 'Hampton, VA, USA' },
      'mcallen': { latitude: 26.2034, longitude: -98.2300, displayName: 'McAllen, TX, USA' },
      'warren': { latitude: 42.5145, longitude: -83.0146, displayName: 'Warren, MI, USA' },
      'bellevue': { latitude: 47.6101, longitude: -122.2015, displayName: 'Bellevue, WA, USA' },
      'west valley city': { latitude: 40.6916, longitude: -112.0011, displayName: 'West Valley City, UT, USA' },
      'columbia': { latitude: 34.0007, longitude: -81.0348, displayName: 'Columbia, SC, USA' },
      'olathe': { latitude: 38.8814, longitude: -94.8191, displayName: 'Olathe, KS, USA' },
      'sterling heights': { latitude: 42.5803, longitude: -83.0302, displayName: 'Sterling Heights, MI, USA' },
      'new haven': { latitude: 41.3083, longitude: -72.9279, displayName: 'New Haven, CT, USA' },
      'miramar': { latitude: 25.9873, longitude: -80.2322, displayName: 'Miramar, FL, USA' },
      'waco': { latitude: 31.5494, longitude: -97.1466, displayName: 'Waco, TX, USA' },
      'thousand oaks': { latitude: 34.1706, longitude: -118.8376, displayName: 'Thousand Oaks, CA, USA' },
      'cedar rapids': { latitude: 41.9778, longitude: -91.6656, displayName: 'Cedar Rapids, IA, USA' },
      'charleston': { latitude: 32.7765, longitude: -79.9311, displayName: 'Charleston, SC, USA' },
      'visalia': { latitude: 36.3302, longitude: -119.2921, displayName: 'Visalia, CA, USA' },
      'topeka': { latitude: 39.0473, longitude: -95.6890, displayName: 'Topeka, KS, USA' },
      'elizabeth': { latitude: 40.6640, longitude: -74.2107, displayName: 'Elizabeth, NJ, USA' },
      'gainesville': { latitude: 29.6516, longitude: -82.3248, displayName: 'Gainesville, FL, USA' },
      'thornton': { latitude: 39.8681, longitude: -104.9719, displayName: 'Thornton, CO, USA' },
      'roseville': { latitude: 38.7521, longitude: -121.2880, displayName: 'Roseville, CA, USA' },
      'carrollton': { latitude: 32.9537, longitude: -96.8903, displayName: 'Carrollton, TX, USA' },
      'coral springs': { latitude: 26.2712, longitude: -80.2706, displayName: 'Coral Springs, FL, USA' },
      'stamford': { latitude: 41.0534, longitude: -73.5387, displayName: 'Stamford, CT, USA' },
      'simi valley': { latitude: 34.2694, longitude: -118.7815, displayName: 'Simi Valley, CA, USA' },
      'concord': { latitude: 37.9780, longitude: -122.0311, displayName: 'Concord, CA, USA' },
      'hartford': { latitude: 41.7658, longitude: -72.6734, displayName: 'Hartford, CT, USA' },
      'kent': { latitude: 47.3809, longitude: -122.2348, displayName: 'Kent, WA, USA' },
      'lafayette': { latitude: 30.2241, longitude: -92.0198, displayName: 'Lafayette, LA, USA' },
      'midland': { latitude: 31.9974, longitude: -102.0779, displayName: 'Midland, TX, USA' },
      'surprise': { latitude: 33.6292, longitude: -112.3679, displayName: 'Surprise, AZ, USA' },
      'denton': { latitude: 33.2148, longitude: -97.1331, displayName: 'Denton, TX, USA' },
      'victorville': { latitude: 34.5362, longitude: -117.2911, displayName: 'Victorville, CA, USA' },
      'evansville': { latitude: 37.9716, longitude: -87.5710, displayName: 'Evansville, IN, USA' },
      'santa clara': { latitude: 37.3541, longitude: -121.9552, displayName: 'Santa Clara, CA, USA' },
      'abilene': { latitude: 32.4487, longitude: -99.7331, displayName: 'Abilene, TX, USA' },
      'athens': { latitude: 33.9519, longitude: -83.3576, displayName: 'Athens, GA, USA' },
      'vallejo': { latitude: 38.1041, longitude: -122.2566, displayName: 'Vallejo, CA, USA' },
      'allentown': { latitude: 40.6084, longitude: -75.4902, displayName: 'Allentown, PA, USA' },
      'norman': { latitude: 35.2226, longitude: -97.4395, displayName: 'Norman, OK, USA' },
      'beaumont': { latitude: 30.0802, longitude: -94.1266, displayName: 'Beaumont, TX, USA' },
      'independence': { latitude: 39.0911, longitude: -94.4155, displayName: 'Independence, MO, USA' },
      'murfreesboro': { latitude: 35.8456, longitude: -86.3903, displayName: 'Murfreesboro, TN, USA' },
      'ann arbor': { latitude: 42.2808, longitude: -83.7430, displayName: 'Ann Arbor, MI, USA' },
      'berkeley': { latitude: 37.8716, longitude: -122.2727, displayName: 'Berkeley, CA, USA' },
      'provo': { latitude: 40.2338, longitude: -111.6585, displayName: 'Provo, UT, USA' },
      'el monte': { latitude: 34.0686, longitude: -118.0276, displayName: 'El Monte, CA, USA' },
      'lansing': { latitude: 42.3314, longitude: -84.5557, displayName: 'Lansing, MI, USA' },
      'fargo': { latitude: 46.8772, longitude: -96.7898, displayName: 'Fargo, ND, USA' },
      'downey': { latitude: 33.9401, longitude: -118.1326, displayName: 'Downey, CA, USA' },
      'costa mesa': { latitude: 33.6411, longitude: -117.9187, displayName: 'Costa Mesa, CA, USA' },
      'wilmington': { latitude: 34.2257, longitude: -77.9447, displayName: 'Wilmington, NC, USA' },
      'arvada': { latitude: 39.8028, longitude: -105.0875, displayName: 'Arvada, CO, USA' },
      'inglewood': { latitude: 33.9617, longitude: -118.3531, displayName: 'Inglewood, CA, USA' },
      'miami gardens': { latitude: 25.9420, longitude: -80.2456, displayName: 'Miami Gardens, FL, USA' },
      'carlsbad': { latitude: 33.1581, longitude: -117.3506, displayName: 'Carlsbad, CA, USA' },
      'westminster': { latitude: 39.8367, longitude: -105.0372, displayName: 'Westminster, CO, USA' },
      'pearland': { latitude: 29.5638, longitude: -95.2861, displayName: 'Pearland, TX, USA' },
      'clearwater': { latitude: 27.9659, longitude: -82.8001, displayName: 'Clearwater, FL, USA' },
      'high point': { latitude: 35.9557, longitude: -80.0053, displayName: 'High Point, NC, USA' },
      'west covina': { latitude: 34.0686, longitude: -117.9390, displayName: 'West Covina, CA, USA' },
      'murrieta': { latitude: 33.5539, longitude: -117.2139, displayName: 'Murrieta, CA, USA' },
      'manchester': { latitude: 42.9956, longitude: -71.4548, displayName: 'Manchester, NH, USA' },
      'cambridge': { latitude: 42.3736, longitude: -71.1097, displayName: 'Cambridge, MA, USA' },
      'antioch': { latitude: 37.9857, longitude: -121.8058, displayName: 'Antioch, CA, USA' },
      'temecula': { latitude: 33.4936, longitude: -117.1484, displayName: 'Temecula, CA, USA' },
      'nashua': { latitude: 42.7654, longitude: -71.4676, displayName: 'Nashua, NH, USA' },
      'lowell': { latitude: 42.6334, longitude: -71.3162, displayName: 'Lowell, MA, USA' },
      'pompano beach': { latitude: 26.2379, longitude: -80.1248, displayName: 'Pompano Beach, FL, USA' },
      'citrus heights': { latitude: 38.7071, longitude: -121.2811, displayName: 'Citrus Heights, CA, USA' },
      'macon': { latitude: 32.8407, longitude: -83.6324, displayName: 'Macon, GA, USA' },
      'lewisville': { latitude: 33.0462, longitude: -96.9942, displayName: 'Lewisville, TX, USA' },
      'south bend': { latitude: 41.6764, longitude: -86.2520, displayName: 'South Bend, IN, USA' },
      'missoula': { latitude: 46.8721, longitude: -113.9940, displayName: 'Missoula, MT, USA' },
      'sparks': { latitude: 39.5349, longitude: -119.7527, displayName: 'Sparks, NV, USA' },
      'broken arrow': { latitude: 36.0526, longitude: -95.7969, displayName: 'Broken Arrow, OK, USA' },
      'federal way': { latitude: 47.3223, longitude: -122.3126, displayName: 'Federal Way, WA, USA' },
      'beaverton': { latitude: 45.4871, longitude: -122.8037, displayName: 'Beaverton, OR, USA' },
      'livermore': { latitude: 37.6819, longitude: -121.7680, displayName: 'Livermore, CA, USA' },
      'norwalk': { latitude: 33.9022, longitude: -118.0817, displayName: 'Norwalk, CA, USA' },
      'redding': { latitude: 40.5865, longitude: -122.3917, displayName: 'Redding, CA, USA' },
      'rialto': { latitude: 34.1006, longitude: -117.3703, displayName: 'Rialto, CA, USA' },
      'davenport': { latitude: 41.5236, longitude: -90.5776, displayName: 'Davenport, IA, USA' },
      'sunrise manor': { latitude: 36.2110, longitude: -115.0731, displayName: 'Sunrise Manor, NV, USA' },
      'chico': { latitude: 39.7285, longitude: -121.8375, displayName: 'Chico, CA, USA' },
      'las cruces': { latitude: 32.3199, longitude: -106.7637, displayName: 'Las Cruces, NM, USA' },
      'greeley': { latitude: 40.4233, longitude: -104.7091, displayName: 'Greeley, CO, USA' },
      'ventura': { latitude: 34.2746, longitude: -119.2290, displayName: 'Ventura, CA, USA' },
      'south gate': { latitude: 33.9548, longitude: -118.2120, displayName: 'South Gate, CA, USA' },
      'tyler': { latitude: 32.3513, longitude: -95.3011, displayName: 'Tyler, TX, USA' },
      'hillsboro': { latitude: 45.5229, longitude: -122.9890, displayName: 'Hillsboro, OR, USA' },
      'west jordan': { latitude: 40.6097, longitude: -111.9391, displayName: 'West Jordan, UT, USA' },
      'billings': { latitude: 45.7833, longitude: -108.5007, displayName: 'Billings, MT, USA' },
      'pueblo': { latitude: 38.2544, longitude: -104.6091, displayName: 'Pueblo, CO, USA' },
      'daly city': { latitude: 37.7058, longitude: -122.4622, displayName: 'Daly City, CA, USA' },
      'allen': { latitude: 33.1031, longitude: -96.6706, displayName: 'Allen, TX, USA' },
      'boulder': { latitude: 40.0150, longitude: -105.2705, displayName: 'Boulder, CO, USA' },
      'santa maria': { latitude: 34.9530, longitude: -120.4357, displayName: 'Santa Maria, CA, USA' },
      'woodbridge': { latitude: 38.6581, longitude: -77.2497, displayName: 'Woodbridge, VA, USA' }
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
    }
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
        user_agent: 'LocationLeadDashboard/1.0 (contact@encodeset.com)'
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
});
