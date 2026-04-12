// Reads WEATHERMAP_API_KEY from .env (local) or process.env (CI)
// and writes the value into src/environments/environment.ts before the build.
const fs = require('fs');
const path = require('path');

// Load .env file if it exists (local development)
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const apiKey = process.env.WEATHERMAP_API_KEY;
if (!apiKey) {
  console.error('ERROR: WEATHERMAP_API_KEY is not set. Add it to .env or as a CI secret.');
  process.exit(1);
}

const content = `export const environment = {
  production: false,
  openWeatherMapApiKey: '${apiKey}',
};
`;

fs.writeFileSync('src/environments/environment.ts', content);
console.log('environment.ts written with API key.');
