/**
 * Local CLI for minting an API key -- deliberately NOT an HTTP endpoint. Issuing new
 * credentials is an operator action (you, running this on the machine that owns the
 * database), not something exposed over the network unauthenticated.
 *
 * Usage: node src/create-api-key.ts "My Integration Name" [read|read,write]
 */
import { generateApiKey } from "./auth.ts";

const label = process.argv[2];
const scopes = (process.argv[3] as "read" | "read,write") ?? "read,write";

if (!label) {
  console.error('Usage: node src/create-api-key.ts "Label" [read|read,write]');
  process.exit(1);
}

const key = generateApiKey(label, scopes);
console.log(`API key created for "${label}" (scopes: ${scopes})`);
console.log(key);
console.log("\nThis is shown once -- store it now. Only a hash is kept in the database.");
