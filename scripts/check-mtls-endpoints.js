const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { checkUrlWithMtls } = require('./mtls-helper');

/**
 * This script checks endpoints that require mTLS authentication.
 * It reads the .upptimerc.yml file to get the list of endpoints,
 * and uses the mtls-helper.js functions to check them.
 */
async function main() {
  try {
    // Read the .upptimerc.yml file
    const configPath = path.join(__dirname, '../.upptimerc.yml');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent);

    // Get the list of endpoints that require mTLS authentication
    // You can add a custom property to the site configuration in .upptimerc.yml
    // to indicate that it requires mTLS authentication
    const mtlsEndpoints = config.sites.filter(site => site.mtls === true);

    console.log(`Found ${mtlsEndpoints.length} endpoints that require mTLS authentication`);

    // Check each endpoint
    for (const endpoint of mtlsEndpoints) {
      console.log(`Checking ${endpoint.name} (${endpoint.url})...`);
      try {
        const isUp = await checkUrlWithMtls(endpoint.url);
        console.log(`${endpoint.name} is ${isUp ? 'up' : 'down'}`);
        
        // You can add code here to update the status in the history files
        // or create GitHub issues for down endpoints
      } catch (err) {
        console.error(`Error checking ${endpoint.name}:`, err);
      }
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
