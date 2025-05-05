const fs = require('fs');
const path = require('path');
const https = require('https');
const forge = require('node-forge');

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

    // Decode the base64-encoded certificate
    const p12Der = forge.util.decode64(certBase64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword);

    // Extract private key and certificate
    let privateKey, certificate;
    
    // Get bags by type
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
    
    if (certBags && certBags.length > 0) {
      certificate = forge.pki.certificateToPem(certBags[0].cert);
    } else {
      throw new Error('Certificate not found in P12 file');
    }
    
    if (keyBags && keyBags.length > 0) {
      privateKey = forge.pki.privateKeyToPem(keyBags[0].key);
    } else {
      throw new Error('Private key not found in P12 file');
    }

    // Get CA certificates
    const caCerts = [];
    try {
      const caStore = p12.getBags({ bagType: forge.pki.oids.caCertBag });
      if (caStore && caStore[forge.pki.oids.caCertBag]) {
        for (const ca of caStore[forge.pki.oids.caCertBag]) {
          if (ca.cert) {
            caCerts.push(forge.pki.certificateToPem(ca.cert));
          }
        }
      }
    } catch (err) {
      console.warn('Warning: Could not extract CA certificates from P12 file:', err.message);
    }

    // Set up the HTTPS request options with the certificate
    const requestOptions = {
      ...options,
      key: privateKey,
      cert: certificate,
      ca: caCerts.length > 0 ? caCerts : undefined,
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
    
    // Check if the error is a SOAP fault, which means the server is up but returned a SOAP error
    if (err.message && 
        (err.message.includes('soap:Fault') || 
         err.message.includes('No binding operation info') ||
         err.message.includes('Route not found'))) {
      console.log(`URL ${url} returned a SOAP fault or 404, but the server is up`);
      return true;
    }
    
    return false;
  }
}

module.exports = {
  makeSecureRequest,
  checkUrlWithMtls
};
