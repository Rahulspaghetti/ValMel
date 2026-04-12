// Reads WEATHERMAP_API_KEY from .env (local) or process.env (CI)
// and writes the value into src/environments/environment.ts before the build.
const fs = require('fs');
const path = require('path');

// Load .env file if it exists (local development)
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// const apiKey = process.env.WEATHERMAP_API_KEY;
// if (!apiKey) {
//   console.error('ERROR: WEATHERMAP_API_KEY is not set. Add it to .env or as a CI secret.');
//   process.exit(1);
// }

// Read the template and replace the placeholder so the key is never hardcoded in source.
const envFilePath = path.resolve(__dirname, 'src/environments/environment.ts');
let content = fs.readFileSync(envFilePath, 'utf8');

if (!content.includes('WEATHERMAP_API_KEY_PLACEHOLDER')) {
  console.error(
    'ERROR: environment.ts does not contain WEATHERMAP_API_KEY_PLACEHOLDER. ' +
    'Restore the placeholder before building.'
  );
  process.exit(1);
}

content = content.replace('WEATHERMAP_API_KEY_PLACEHOLDER', apiKey);
fs.writeFileSync(envFilePath, content);
console.log('environment.ts written with API key.');
