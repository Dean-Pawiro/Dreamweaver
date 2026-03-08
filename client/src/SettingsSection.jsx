
  import React from "react";
  import AccountSection from "./AccountSection";

function SettingsSection({
  imageApi,
  setImageApi,
  pollinationsModel,
  setPollinationsModel,
  session,
  setSession,
  onLogout
}) {
  // ...existing state and handlers...
  const pollinationsModels = [
    "flux",
    "zimage",
    "flux-2-dev",
    "imagen-4",
    "grok-imagine",
    "klein",
    "klein-large",
    "gptimage"
  ];

  // Handler for dropdown
  const handleImageApiChange = (e) => {
    setImageApi(e.target.value);
    localStorage.setItem("imageApi", e.target.value);
  };

  const handlePollinationsModelChange = (e) => {
    setPollinationsModel(e.target.value);
    localStorage.setItem("pollinationsModel", e.target.value);
  };

  const [balance, setBalance] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const getPollinationsBalance = async () => {
    setLoading(true);
    setError(null);
    setBalance(null);
    try {
      // Call backend proxy endpoint
      const response = await fetch("/api/images/pollinations/balance");
      if (!response.ok) throw new Error("Failed to fetch balance");
      const data = await response.json();
      setBalance(data.balance);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Master user management state
  const [users, setUsers] = React.useState([]);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [usersError, setUsersError] = React.useState(null);
  const [actionStatus, setActionStatus] = React.useState("");

  // Helper: is master
  const isMaster = session && session.username === "master";

  // Fetch users (master only)
  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch users");
      setUsers(data.users);
    } catch (err) {
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  React.useEffect(() => {
    if (isMaster) fetchUsers();
    // eslint-disable-next-line
  }, [isMaster]);

  // Delete user
  const handleDeleteUser = async (user_id) => {
    if (!window.confirm("Delete this user and all their data?")) return;
    setActionStatus("");
    try {
      const res = await fetch(`/api/users/${user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      setActionStatus("User deleted");
      setUsers(users => users.filter(u => u.user_id !== user_id));
    } catch (err) {
      setActionStatus(err.message);
    }
  };

  // Delete all chats for user
  const handleDeleteChats = async (user_id) => {
    if (!window.confirm("Delete ALL chats for this user?")) return;
    setActionStatus("");
    try {
      const res = await fetch(`/api/users/${user_id}/chats`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete chats");
      setActionStatus("All chats deleted for user");
    } catch (err) {
      setActionStatus(err.message);
    }
  };

  return (
    <main className="settings-container">
      <section className="settings-section">
        <h2>Image Generation</h2>
        <div className="settings-row" role="group" aria-label="Image generation settings">
          <div className="settings-field">
            <label htmlFor="image-api-select">Image Generation API</label>
            <select
              id="image-api-select"
              value={imageApi}
              onChange={handleImageApiChange}
            >
              <option value="openrouter">OpenRouter</option>
              <option value="pollinations">Pollinations</option>
            </select>
          </div>

          {imageApi === "pollinations" && (
            <>
              <div className="settings-field">
                <label htmlFor="pollinations-model-select">Pollinations Model</label>
                <select
                  id="pollinations-model-select"
                  value={pollinationsModel}
                  onChange={handlePollinationsModelChange}
                >
                  {pollinationsModels.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="settings-balance">
                <button type="button" onClick={getPollinationsBalance} disabled={loading}>
                  {loading ? "Getting Balance..." : "Get Balance"}
                </button>
                <div className="settings-balance-status" aria-live="polite">
                  {error && <span className="error">Error: {error}</span>}
                  {balance !== null && !error && <span>Balance: {balance}</span>}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {isMaster && (
        <section className="settings-section" aria-labelledby="user-management-title">
          <h2 id="user-management-title">User Management <span className="settings-section-sub">(Master Only)</span></h2>
          {usersLoading && <div>Loading users...</div>}
          {usersError && <div className="error">{usersError}</div>}
          {actionStatus && (
            <div
              className={actionStatus.includes("deleted") ? "settings-status success" : "settings-status error"}
              aria-live="polite"
            >
              {actionStatus}
            </div>
          )}
          <table className="user-table">
            <caption className="visually-hidden">User accounts and management actions</caption>
            <thead>
              <tr>
                <th>Username</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td>{u.username}</td>
                  <td>
                    <div className="user-actions">
                      <button
                        onClick={() => handleDeleteUser(u.user_id)}
                        className="danger"
                        disabled={u.username === "master"}
                      >
                        Delete User
                      </button>
                      <button
                        onClick={() => handleDeleteChats(u.user_id)}
                        className="warning"
                      >
                        Delete All Chats
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="settings-section">
        <AccountSection session={session} setSession={setSession} onLogout={onLogout} />
      </section>
      <div className="settings-coming-soon">More settings coming soon...</div>
    </main>
  );
}

export default SettingsSection;
