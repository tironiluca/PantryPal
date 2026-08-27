import { mkdir, readFile, writeFile } from 'node:fs/promises';

try {
  const dotenv = await readFile('.env', 'utf8');
  for (const line of dotenv.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const requiredVariables = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  console.error(`Missing required environment variable(s): ${missingVariables.join(', ')}`);
  console.error('Copy .env.example to .env and provide the Supabase project values.');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!/^https:\/\/[^\s/]+\.supabase\.co(?:\/.*)?$/.test(supabaseUrl)) {
  console.error('SUPABASE_URL must be an HTTPS Supabase project URL.');
  process.exit(1);
}

const environment = (production) => `export const environment = {
  production: ${production},
  supabase: {
    url: ${JSON.stringify(supabaseUrl)},
    anonKey: ${JSON.stringify(supabaseAnonKey)},
  },
};
`;

await mkdir('src/environments', { recursive: true });
await Promise.all([
  writeFile('src/environments/environment.ts', environment(false), 'utf8'),
  writeFile('src/environments/environment.prod.ts', environment(true), 'utf8'),
]);

console.log('Generated Angular environment files from Supabase build variables.');