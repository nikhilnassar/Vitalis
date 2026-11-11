#!/usr/bin/env bash
# Creates YOUR Android upload key. Run once, on your own computer, and back the file up somewhere safe.
# Never commit the .jks file or its passwords, and never send them to anyone (including an AI assistant).
set -euo pipefail
OUT="${1:-vitalis-upload.jks}"
if [ -e "$OUT" ]; then echo "$OUT already exists, refusing to overwrite."; exit 1; fi
keytool -genkeypair -v -storetype PKCS12 -keystore "$OUT" -alias vitalis-upload \
  -keyalg RSA -keysize 2048 -validity 10000
echo
echo "Created $OUT."
echo "Next: either let EAS manage signing (recommended: 'eas credentials' and choose to generate a keystore),"
echo "or upload this key when 'eas build' asks. Then enrol in Play App Signing in the Play Console."
echo "Print the fingerprint to register with Google APIs if you ever need it:"
echo "  keytool -list -v -keystore $OUT -alias vitalis-upload"
