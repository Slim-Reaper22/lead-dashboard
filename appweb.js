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
let smartsuiteConfig = {
  apiKey: 'c5f0367be5ffdc0f0ff804d8bfc1647b3d9abe38',
  appId: '67c735724878712509589af7',
  tableId: '67c8fdfb508eb94c4784fb95',
  accountId: 'sxs77u60'
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
      // Get address components
      let address = '';
      if (item.s5d25b0846) {
        const loc = item.s5d25b0846;
        const parts = [
          loc.location_address,
          loc.location_address2,
          loc.location_city,
          loc.location_state,
          loc.location_zip,
          loc.location_country
        ].filter(part => part && part.trim() !== '');
        
        address = parts.join(', ');
      }
      
      return {
        'Company': item.s79c2f08d9 || item.title || '',
        'Address': address,
        'Estimated New Jobs': parseInt(item.s20f809da6 || 0),
        'Activity Type': item.s560d452b4 ? item.s560d452b4.label : '',
        'Timeframe': item.s8a9285317 ? item.s8a9285317.label : '',
        'General Lead Summary': item.s54a8cc7de || '',
        'About': item.sb7f0cac0e || ''
      };
    });

    console.log(`Transformed ${transformedData.length} records for the dashboard`);
    
    // Log the first transformed record
    if (transformedData.length > 0) {
      console.log('Sample transformed record:', transformedData[0]);
    }
    
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
    // Load SmartSuite config if stored somewhere (file, env vars, etc.)
    // This is just a placeholder - implement your preferred method
    // For example: smartsuiteConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    
    // Then load the data if config is set
    if (smartsuiteConfig.apiKey) {
      leadsData = await loadSmartSuiteData();
    }
  } catch (error) {
    console.error('Error loading initial data:', error);
  }
})();

// Main dashboard route - no login required
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
  
  res.render('dashboard', { 
    leads: leadsData,
    states: states,
    totalLeads,
    totalJobs,
    totalActivityTypes,
    activityCounts,
    selectedState: null,
    searchTerm: null, // Add this line
    isLoggedIn: req.session.loggedIn || false // Pass login status to template
  });
});

// State filter route - no login required
app.get('/filter', (req, res) => {
  const { state } = req.query;
  
  // Generate a complete list of all 50 states
  const states = Object.values(stateFullNames).sort();
  
  // Filter leads by state if state is provided
  let filteredLeads = leadsData;
  if (state && state !== 'All States') {
    filteredLeads = leadsData.filter(lead => {
      const address = lead.Address || '';
      
      // Only check for the full state name in the address
      return address.toLowerCase().includes(state.toLowerCase());
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
  
  res.render('dashboard', { 
    leads: filteredLeads,
    states: states,
    totalLeads,
    totalJobs,
    totalActivityTypes,
    activityCounts,
    selectedState: state,
    searchTerm: null, // Add this line
    isLoggedIn: req.session.loggedIn || false // Pass login status to template
  });
});

// Company search route - no login required
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
  
  res.render('dashboard', { 
    leads: filteredLeads,
    states: states,
    totalLeads,
    totalJobs,
    totalActivityTypes,
    activityCounts,
    selectedState: null,
    searchTerm: company, // Pass the search term to the template
    isLoggedIn: req.session.loggedIn || false
  });
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

app.listen(port, () => {
  console.log(`Lead Dashboard app listening at http://localhost:${port}`);
});
