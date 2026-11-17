/**
 * User password policy — an exact mirror of backend/password_policy.py
 * `check_user_password` (spec 008, R-N6.1). The backend is authoritative; this
 * copy lets forms show the same requirements and errors before submitting.
 * A backend parity test (tests/unit/test_frontend_parity.py) fails if the two
 * drift apart (constants, denylist and shared test vectors).
 */
export const USER_MIN_LENGTH = 12;
export const MAX_BYTES = 72; // bcrypt limit
export const USER_MIN_DISTINCT = 6;
export const DENYLIST = [
  "changeme", "password", "passw0rd", "admin", "administrator", "bitbotpro",
  "bridgebot", "botforge", "letmein", "welcome", "qwerty", "123456", "secret",
  "default",
];

export const PASSWORD_REQUIREMENTS = [
  `At least ${USER_MIN_LENGTH} characters (at most ${MAX_BYTES} bytes)`,
  `At least ${USER_MIN_DISTINCT} different characters`,
  "No spaces at the start or end",
  "No common or product words (such as \"password\", \"admin\", \"qwerty\", \"123456\", \"bitbotpro\")",
  "No part of your email address",
];

function utf8Length(text) {
  let bytes = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Returns a list of policy violations (empty = acceptable). Same messages as the backend. */
export function checkUserPassword(password, email) {
  if (typeof password !== "string" || !password) return ["password is empty"];
  const problems = [];
  const chars = Array.from(password); // code points, like Python len()
  if (password !== password.trim()) problems.push("password must not start or end with whitespace");
  if (chars.length < USER_MIN_LENGTH) problems.push(`password must be at least ${USER_MIN_LENGTH} characters`);
  if (utf8Length(password) > MAX_BYTES) problems.push(`password must be at most ${MAX_BYTES} bytes`);
  const lowered = password.toLowerCase();
  if (DENYLIST.some((w) => lowered.includes(w))) problems.push("password contains a common or product-related word");
  const [local = "", domain = ""] = String(email || "").toLowerCase().split(/@(.*)/s);
  const tokens = new Set(local.length >= 3 ? [local] : []);
  domain.split(".").forEach((label) => { if (label.length >= 4) tokens.add(label); });
  if ([...tokens].some((t) => lowered.includes(t))) problems.push("password must not contain parts of the email address");
  if (new Set(chars).size < USER_MIN_DISTINCT) problems.push("password has too few distinct characters");
  return problems;
}

/** A single user-facing message (same wording as the backend 400), or null. */
export function userPasswordError(password, email) {
  const problems = checkUserPassword(password, email);
  return problems.length ? `Password does not meet the requirements: ${problems.join("; ")}.` : null;
}
