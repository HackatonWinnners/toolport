import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Keypair, StrKey } from "@stellar/stellar-sdk";

const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

/**
 * Sign-in with a Stellar wallet: the dashboard asks Freighter to sign a one-time message.
 * Challenges are stateless (HMAC-bound to address and expiry), so any serverless instance can verify them.
 */
export class WalletAuth {
  constructor(
    private readonly secret: string,
    private readonly disabled = false,
  ) {}

  challenge(address: string) {
    if (!StrKey.isValidEd25519PublicKey(address)) throw new Error("Invalid Stellar address");
    const expires = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
    const salt = randomBytes(8).toString("hex");
    const message = `Sign in to StellarPay MCP\nAddress: ${address}\nExpires: ${expires}\nNonce: ${salt}.${this.mac(`${address}|${expires}|${salt}`)}`;
    return { message };
  }

  /** Verify a SEP-53 signed challenge (what Freighter's signMessage produces) and issue a session token. */
  verify(address: string, signature: string, message = ""): string {
    if (!this.disabled) {
      const fields = /^Sign in to StellarPay MCP\nAddress: (\S+)\nExpires: (\S+)\nNonce: ([0-9a-f]+)\.(\S+)$/.exec(message);
      if (!fields || fields[1] !== address) throw new Error("Bad challenge, request a new one");
      const [, , expires, salt, mac] = fields;
      if (!this.macMatches(`${address}|${expires}|${salt}`, mac)) throw new Error("Bad challenge, request a new one");
      if (!(Date.parse(expires) > Date.now())) throw new Error("Challenge expired, request a new one");
      if (!verifySignedMessage(address, message, signature)) throw new Error("Bad signature");
    }
    return this.issue(address);
  }

  issue(address: string): string {
    const body = Buffer.from(JSON.stringify({ address, exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
    return `${body}.${this.mac(body)}`;
  }

  /** Returns the signed-in address, or null. */
  read(authorization: string | undefined | null): string | null {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    if (this.disabled && StrKey.isValidEd25519PublicKey(token)) return token; // dev: "Bearer G..."
    const [body, mac] = token.split(".");
    if (!body || !mac || !this.macMatches(body, mac)) return null;
    const { address, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    return exp > Date.now() ? address : null;
  }

  private mac(body: string) {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }

  private macMatches(body: string, mac: string) {
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

export function verifySignedMessage(address: string, message: string, signature: string): boolean {
  const keypair = Keypair.fromPublicKey(address);
  const sig = /^[0-9a-f]+$/i.test(signature) && signature.length === 128
    ? Buffer.from(signature, "hex")
    : Buffer.from(signature, "base64");
  // SEP-53: sign sha256("Stellar Signed Message:\n" + message)
  const sep53 = createHash("sha256").update(`Stellar Signed Message:\n${message}`).digest();
  try {
    return keypair.verify(sep53, sig) || keypair.verify(Buffer.from(message), sig);
  } catch {
    return false;
  }
}
