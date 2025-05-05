# Setting Up mTLS Certificate for Upptime

This document provides instructions for setting up mutual TLS (mTLS) authentication for Upptime monitoring.

## Adding the Certificate to GitHub Secrets

1. The P12 certificate has been base64-encoded and saved to `mtls-internal-tester.p12.base64`.

2. Add the certificate as a GitHub secret:
   - Go to your GitHub repository: https://github.com/Certegy-Payment-Solutions/upptime
   - Navigate to "Settings" > "Secrets and variables" > "Actions"
   - Click "New repository secret"
   - Name: `MTLS_CERTIFICATE`
   - Value: Copy and paste the entire content of the `mtls-internal-tester.p12.base64` file
   - Click "Add secret"

3. Add the certificate password as a GitHub secret:
   - Click "New repository secret" again
   - Name: `MTLS_CERTIFICATE_PASSWORD`
   - Value: Enter the password for the P12 certificate
   - Click "Add secret"

## Using the Certificate in Upptime

The `scripts/mtls-helper.js` file provides functions for making HTTPS requests with mTLS authentication. This can be used to check endpoints that require mTLS authentication.

To use this in your Upptime configuration:

1. For endpoints that require mTLS authentication, you can add a custom check script that uses the `mtls-helper.js` functions.

2. The GitHub Actions workflows will have access to the certificate through the `MTLS_CERTIFICATE` and `MTLS_CERTIFICATE_PASSWORD` secrets.

## Next Steps

After adding the secrets, you can create a custom script that uses the `mtls-helper.js` functions to check endpoints that require mTLS authentication. This script can be integrated with the Upptime workflows or run as a separate workflow.
