/**
 * Minimal TOTP implementation using Node.js built-in crypto.
 * Compatible with Google Authenticator and other RFC 6238 apps.
 */
import { createHmac, randomBytes } from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  const upper = str.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of upper) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  // Write counter as big-endian 64-bit int (only 32-bit needed in practice)
  msg.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    (((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, '0');
}

/** Generate a fresh base32-encoded TOTP secret */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Compute the current TOTP code */
export function getTotpCode(secret: string, step = 30): string {
  const counter = Math.floor(Date.now() / 1000 / step);
  return hotp(secret, counter);
}

/** Verify a TOTP code (±1 window for clock drift) */
export function verifyTotpCode(
  secret: string,
  code: string,
  step = 30,
  window = 1,
): boolean {
  const counter = Math.floor(Date.now() / 1000 / step);
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + i) === code) return true;
  }
  return false;
}

/** Build an otpauth:// URI for QR code generation */
export function buildOtpAuthUri(
  secret: string,
  account: string,
  issuer = 'EmpireShop',
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params}`;
}

/** Build a Google Charts QR code URL (no extra packages needed) */
export function buildQrCodeUrl(otpAuthUri: string, size = 200): string {
  return `https://chart.googleapis.com/chart?chs=${size}x${size}&chld=M|0&cht=qr&chl=${encodeURIComponent(otpAuthUri)}`;
}
