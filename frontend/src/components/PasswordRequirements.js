import { PASSWORD_REQUIREMENTS, checkUserPassword } from "../utils/passwordPolicy";

/**
 * Shows the backend password requirements (spec 008, R-N6.1) and, once the user
 * has typed something, which ones are not met yet.
 */
export default function PasswordRequirements({ password = "", email = "", style }) {
  const problems = password ? checkUserPassword(password, email) : [];
  return (
    <div data-testid="password-requirements" style={{ fontSize: "12px", lineHeight: 1.5, margin: "6px 0 10px", ...style }}>
      <div style={{ opacity: 0.75 }}>Password requirements:</div>
      <ul style={{ margin: "2px 0 0", paddingLeft: "18px", opacity: 0.75 }}>
        {PASSWORD_REQUIREMENTS.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {problems.length > 0 && (
        <ul data-testid="password-problems" style={{ margin: "4px 0 0", paddingLeft: "18px", color: "#F43F5E" }}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}
