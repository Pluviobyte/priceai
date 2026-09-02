import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  process.stderr.write("usage: node scripts/hash-admin-password.mjs '<password-at-least-12-chars>'\n");
  process.exit(1);
}
const salt = randomBytes(16);
process.stdout.write(`scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 64).toString("base64url")}\n`);
