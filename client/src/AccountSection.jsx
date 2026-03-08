import React, { useState } from "react";

function AccountSection({ session, setSession, onLogout }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setStatus("");
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token || session.user_id}`
        },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      setStatus("Password updated!");
      setPassword("");
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <section id="account-section" className="account-section" aria-labelledby="account-settings-title">
      <h2 id="account-settings-title">Account</h2>

      <div className="account-field">
        <label htmlFor="account-username">Username</label>
        <input
          id="account-username"
          value={session && session.username ? session.username : ""}
          disabled
          readOnly
        />
      </div>

      <form onSubmit={handlePasswordUpdate} className="account-form">
        <div className="account-field">
          <label htmlFor="account-password">New Password</label>
          <input
            id="account-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit">Update Password</button>
        {status && (
          <div
            className={status.includes("updated") ? "account-status success" : "account-status error"}
            aria-live="polite"
          >
            {status}
          </div>
        )}
      </form>

      <div className="account-actions">
        <button type="button" onClick={onLogout}>Logout</button>
      </div>
    </section>
  );
}

export default AccountSection;
