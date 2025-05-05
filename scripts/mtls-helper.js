const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Helper function to make HTTPS requests with mTLS authentication
 * @param {string} url - The URL to request
 * @param {Object} options - Additional request options
 * @returns {Promise<Object>} - The response data
 */
async function makeSecureRequest(url, options = {}) {
  try {
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

    // Create a temporary directory
    const tempDir = path.join(__dirname, '../.temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Decode the base64-encoded certificate and save it to a temporary file
    const p12Path = path.join(tempDir, 'certificate.p12');
    fs.writeFileSync(p12Path, Buffer.from(certBase64, 'base64'));

    // Convert P12 to PEM using OpenSSL
    const keyPath = path.join(tempDir, 'key.pem');
    const certPath = path.join(tempDir, 'cert.pem');
    
    // Extract the private key
    await execAsync(`openssl pkcs12 -in ${p12Path} -nocerts -nodes -out ${keyPath} -passin pass:${certPassword}`);
    
    // Extract the certificate
    await execAsync(`openssl pkcs12 -in ${p12Path} -clcerts -nokeys -out ${certPath} -passin pass:${certPassword}`);

    // Read the PEM files
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);

    // Set up the HTTPS request options with the certificate
    const requestOptions = {
      ...options,
      key: key,
      cert: cert,
      rejectUnauthorized: false, // Set to true in production
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3'
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          // Clean up the temporary files
          try {
            fs.unlinkSync(p12Path);
            fs.unlinkSync(keyPath);
            fs.unlinkSync(certPath);
          } catch (err) {
            console.error('Error cleaning up temporary files:', err);
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
        // Clean up the temporary files
        try {
          fs.unlinkSync(p12Path);
          fs.unlinkSync(keyPath);
          fs.unlinkSync(certPath);
        } catch (cleanupErr) {
          console.error('Error cleaning up temporary files:', cleanupErr);
        }
        reject(err);
      });

      if (options.method === 'POST' && options.body) {
        req.write(options.body);
      }
      req.end();
    });
  } catch (err) {
    console.error('Error in makeSecureRequest:', err);
    throw err;
  }
}

/**
 * Check if a URL is up using mTLS authentication
 * @param {string} url - The URL to check
 * @param {Object} options - Additional request options
 * @returns {Promise<boolean>} - Whether the URL is up
 */
async function checkUrlWithMtls(url, options = {}) {
  try {
    await makeSecureRequest(url, { method: 'GET', ...options });
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
