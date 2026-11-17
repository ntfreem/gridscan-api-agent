/**
 * Frontend password policy must match backend check_user_password exactly
 * (spec 008, R-N6.1). Vectors are generated from the backend implementation.
 */
import { checkUserPassword, userPasswordError, USER_MIN_LENGTH, MAX_BYTES, USER_MIN_DISTINCT, DENYLIST, PASSWORD_REQUIREMENTS } from "../passwordPolicy";
import data from "../testing/passwordPolicyVectors.json";

test("constants match the backend policy", () => {
  expect([USER_MIN_LENGTH, MAX_BYTES, USER_MIN_DISTINCT]).toEqual([12, 72, 6]);
  expect(DENYLIST).toContain("password");
  expect(DENYLIST).toHaveLength(14);
});

test.each(data.vectors.map((v) => [JSON.stringify(v.password).slice(0, 40), v]))("same verdict as backend: %s", (_label, v) => {
  expect(checkUserPassword(v.password, v.email)).toEqual(v.problems);
  expect(userPasswordError(v.password, v.email)).toEqual(v.error);
});

test("vectors cover both accepted and rejected passwords", () => {
  expect(data.vectors.some((v) => v.problems.length === 0)).toBe(true);
  expect(data.vectors.some((v) => v.problems.length > 1)).toBe(true);
});

test("requirements text states the real limits", () => {
  const text = PASSWORD_REQUIREMENTS.join(" ");
  expect(text).toMatch(/12 characters/);
  expect(text).toMatch(/72 bytes/);
  expect(text).toMatch(/6 different characters/);
  expect(text).not.toMatch(/6 characters\b(?! \(|\.)/);
});

test("error messages never echo the password", () => {
  const pw = "Password1234!";
  expect(userPasswordError(pw, "a@b.co")).not.toContain(pw);
});
