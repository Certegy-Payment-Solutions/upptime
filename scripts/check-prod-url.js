const fs = require('fs');
const path = require('path');
const { checkUrlWithMtls } = require('./mtls-helper');

/**
 * This script checks a production URL with mTLS authentication using the production certificate.
 * Usage: node check-prod-url.js <url>
 */
async function main() {
  try {
    // Get the URL from the command line arguments
    const url = process.argv[2];
    if (!url) {
      console.error('Please provide a URL to check');
      console.error('Usage: node check-prod-url.js <url>');
      process.exit(1);
    }

    // Read the production certificate
    const certPath = path.join(__dirname, '../internaltester-prod.p12.base64');
    if (!fs.existsSync(certPath)) {
      console.error('Production certificate not found at', certPath);
      process.exit(1);
    }
    
    // Set environment variables for the production certificate
    process.env.MTLS_CERTIFICATE = fs.readFileSync(certPath, 'utf8');
    process.env.MTLS_CERTIFICATE_PASSWORD = '+0t!72Qh*}u(';

    // Check the URL
    console.log(`Checking URL: ${url} with production certificate`);
    const isUp = await checkUrlWithMtls(url);
    console.log(`URL ${url} is ${isUp ? 'up' : 'down'}`);
    process.exit(isUp ? 0 : 1);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
