import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
  ".test",
  ".invalid",
];

function isBlockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return true;
  const [a = 0, b = 0] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0] ?? address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) !== 4 || isBlockedIpv4(mapped);
  }
  const first = Number.parseInt(normalized.split(":")[0] ?? "", 16);
  return (
    !Number.isFinite(first) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    normalized.startsWith("2001:db8:") ||
    normalized === "2001:db8::" ||
    normalized.startsWith("100::")
  );
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !isBlockedIpv4(address);
  if (version === 6) return !isBlockedIpv6(address);
  return false;
}

function isLocalSyntheticDnsAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [first = 0, second = 0] = address.split(".").map(Number);
    return first === 198 && (second === 18 || second === 19);
  }
  return address.toLowerCase().startsWith("fdfe:dcba:9876:");
}

export async function assertSafePublicUrl(input: string | URL): Promise<URL> {
  const url = input instanceof URL ? new URL(input) : new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("source_url_protocol_not_allowed");
  }
  if (url.username || url.password) throw new Error("source_url_credentials_not_allowed");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("source_url_port_not_allowed");
  }
  url.hash = "";
  const hostname = url.hostname.replace(/\.$/, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.length === 0 ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("source_url_hostname_not_allowed");
  }

  const literalVersion = isIP(hostname);
  if (literalVersion > 0) {
    if (!isPublicIpAddress(hostname)) throw new Error("source_url_private_address");
    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("source_url_dns_empty");
  if (addresses.length > 16) throw new Error("source_url_dns_excessive");
  const allowSyntheticDns = process.env.ALLOW_LOCAL_SYNTHETIC_DNS === "true";
  if (
    addresses.some(({ address }) =>
      !isPublicIpAddress(address) &&
      !(allowSyntheticDns && isLocalSyntheticDnsAddress(address)),
    )
  ) {
    throw new Error("source_url_private_address");
  }
  return url;
}
