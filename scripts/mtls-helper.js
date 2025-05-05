const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');

/**
 * Helper function to make HTTPS requests with mTLS authentication
 * @param {string} url - The URL to request
 * @param {Object} options - Additional request options
 * @returns {Promise<Object>} - The response data
 */
async function makeSecureRequest(url, options = {}) {
  // Get the certificate from environment variable
  const certBase64 = process.env.MTLS_CERTIFICATE;
  if (!certBase64) {
    throw new Error('MTLS_CERTIFICATE environment variable is not set');
  }

  // Get the certificate password from environment variable
  const certPassword = process.env.MTLS_CERTIFICATE_PASSWORD;
  if (!certPassword) {
    throw new Error('MTLS_CERTIFICATE_PASSWORD environment variable is not set');
  }

  // Decode the base64-encoded certificate
  const certBuffer = Buffer.from(certBase64, 'base64');

  // Create a temporary file to store the certificate
  const tempDir = path.join(__dirname, '../.temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const certPath = path.join(tempDir, 'certificate.p12');
  fs.writeFileSync(certPath, certBuffer);

  // Set up the HTTPS request options with the certificate
  const requestOptions = {
    ...options,
    pfx: certBuffer,
    passphrase: certPassword,
    rejectUnauthorized: false // Set to true in production
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        // Clean up the temporary certificate file
        try {
          fs.unlinkSync(certPath);
        } catch (err) {
          console.error('Error cleaning up temporary certificate file:', err);
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (err) {
            resolve(data);
          }
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      // Clean up the temporary certificate file
      try {
        fs.unlinkSync(certPath);
      } catch (cleanupErr) {
        console.error('Error cleaning up temporary certificate file:', cleanupErr);
      }
      reject(err);
    });

    if (options.method === 'POST' && options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Check if a URL is up using mTLS authentication
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} - Whether the URL is up
 */
async function checkUrlWithMtls(url) {
  try {
    await makeSecureRequest(url, { method: 'GET' });
    return true;
  } catch (err) {
    console.error(`Error checking URL ${url}:`, err);
    return false;
  }
}

module.exports = {
  makeSecureRequest,
  checkUrlWithMtls
};
