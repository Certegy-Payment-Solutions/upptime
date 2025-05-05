const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { checkUrlWithMtls } = require('./mtls-helper');

/**
 * This script checks endpoints that require mTLS authentication.
 * It reads the .upptimerc.yml file to get the list of endpoints,
 * and uses the mtls-helper.js functions to check them.
 * It then updates the history files with the status.
 */
async function main() {
  try {
    // Read the .upptimerc.yml file
    const configPath = path.join(__dirname, '../.upptimerc.yml');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent);

    // Get the list of endpoints that require mTLS authentication
    const mtlsEndpoints = config.sites.filter(site => site.mtls === true);

    console.log(`Found ${mtlsEndpoints.length} endpoints that require mTLS authentication`);

    // Check each endpoint
    for (const endpoint of mtlsEndpoints) {
      console.log(`Checking ${endpoint.name} (${endpoint.url})...`);
      try {
        let isUp = false;
        
        // Set environment variables based on whether it's a CCE or PROD endpoint
        if (endpoint.name.includes('CCE')) {
          process.env.MTLS_CERTIFICATE = process.env.CCE_MTLS_CERTIFICATE || process.env.MTLS_CERTIFICATE;
          process.env.MTLS_CERTIFICATE_PASSWORD = process.env.CCE_MTLS_CERTIFICATE_PASSWORD || process.env.MTLS_CERTIFICATE_PASSWORD;
        } else {
          process.env.MTLS_CERTIFICATE = process.env.PROD_MTLS_CERTIFICATE || process.env.MTLS_CERTIFICATE;
          process.env.MTLS_CERTIFICATE_PASSWORD = process.env.PROD_MTLS_CERTIFICATE_PASSWORD || process.env.MTLS_CERTIFICATE_PASSWORD;
        }
        
        // Special handling for Bankpay endpoints that require an Authorization header
        if (endpoint.name.includes('Bankpay') && endpoint.headers && endpoint.headers.length > 0) {
          const authHeader = endpoint.headers.find(h => h.startsWith('Authorization:'));
          if (authHeader) {
            const token = authHeader.split(' ')[2]; // Extract the token from "Authorization: Basic $TOKEN"
            const bankpayToken = process.env.BANKPAY_AUTH_TOKEN || token;
            
            // Make the request with the Authorization header
            isUp = await checkUrlWithMtls(endpoint.url, {
              headers: {
                'Authorization': `Basic ${bankpayToken}`
              }
            });
          } else {
            isUp = await checkUrlWithMtls(endpoint.url);
          }
        } else {
          isUp = await checkUrlWithMtls(endpoint.url);
        }
        
        console.log(`${endpoint.name} is ${isUp ? 'up' : 'down'}`);
        
        // Update the history file
        updateHistoryFile(endpoint, isUp);
      } catch (err) {
        console.error(`Error checking ${endpoint.name}:`, err);
        // If there's an error, mark the endpoint as down
        updateHistoryFile(endpoint, false);
      }
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

/**
 * Update the history file for an endpoint
 * @param {Object} endpoint - The endpoint configuration
 * @param {boolean} isUp - Whether the endpoint is up
 */
function updateHistoryFile(endpoint, isUp) {
  try {
    // Create a slug from the endpoint name
    const slug = endpoint.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Create the history directory if it doesn't exist
    const historyDir = path.join(__dirname, '../history');
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    
    // Create or update the history file
    const historyFile = path.join(historyDir, `${slug}.yml`);
    const now = new Date().toISOString();
    
    let historyData = {
      url: endpoint.url,
      status: isUp ? 'up' : 'down',
      code: isUp ? 200 : 0,
      responseTime: 0,
      lastUpdated: now,
      startTime: now,
      generator: 'Upptime <https://github.com/upptime/upptime>'
    };
    
    // If the history file exists, update it
    if (fs.existsSync(historyFile)) {
      const existingData = yaml.load(fs.readFileSync(historyFile, 'utf8'));
      historyData = {
        ...existingData,
        status: isUp ? 'up' : 'down',
        code: isUp ? 200 : 0,
        lastUpdated: now
      };
    }
    
    // Write the history file
    fs.writeFileSync(historyFile, yaml.dump(historyData));
    console.log(`Updated history file for ${endpoint.name}`);
    
    // Update the summary.json file
    updateSummaryFile(endpoint, isUp);
  } catch (err) {
    console.error(`Error updating history file for ${endpoint.name}:`, err);
  }
}

/**
 * Update the summary.json file
 * @param {Object} endpoint - The endpoint configuration
 * @param {boolean} isUp - Whether the endpoint is up
 */
function updateSummaryFile(endpoint, isUp) {
  try {
    // Create a slug from the endpoint name
    const slug = endpoint.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Read the summary.json file if it exists
    const summaryFile = path.join(__dirname, '../history/summary.json');
    let summary = [];
    
    if (fs.existsSync(summaryFile)) {
      summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    }
    
    // Find the endpoint in the summary
    const endpointIndex = summary.findIndex(item => item.name === endpoint.name);
    
    // Create a new summary item if it doesn't exist
    if (endpointIndex === -1) {
      summary.push({
        name: endpoint.name,
        url: endpoint.url,
        icon: `https://icons.duckduckgo.com/ip3/${new URL(endpoint.url).hostname}.ico`,
        slug,
        status: isUp ? 'up' : 'down',
        uptime: '100.00%',
        uptimeDay: '100.00%',
        uptimeWeek: '100.00%',
        uptimeMonth: '100.00%',
        uptimeYear: '100.00%',
        time: 0,
        timeDay: 0,
        timeWeek: 0,
        timeMonth: 0,
        timeYear: 0,
        dailyMinutesDown: {}
      });
    } else {
      // Update the existing summary item
      summary[endpointIndex].status = isUp ? 'up' : 'down';
    }
    
    // Write the summary.json file
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`Updated summary.json for ${endpoint.name}`);
  } catch (err) {
    console.error(`Error updating summary.json for ${endpoint.name}:`, err);
  }
}

main();
