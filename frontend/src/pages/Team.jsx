import React, { useState, useEffect } from "react";
import { apiUsers, apiAuth } from "../services/api";
import { UserPlus, Shield, User, Copy, Check } from "lucide-react";

export default function Team() {
  const user = apiAuth.getUser();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [inviteResult, setInviteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const loadMembers = () => {
    apiUsers.getMembers().then(setMembers).catch(console.error);
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setInviteResult(null);
    setLoading(true);

    try {
      const data = await apiUsers.inviteMember(email.trim());
      setInviteResult(data);
      setEmail("");
      loadMembers();
    } catch (err) {
      setError(err.message || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  const getInviteLink = (token) => {
    return `${window.location.origin}/signup?token=${token}`;
  };

  const copyToClipboard = (link) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team Management</h1>
          <p className="text-xs text-gray-500 mt-1">Manage team members and invite agents to your workspace</p>
        </div>
      </div>

      {user?.role === "admin" ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-xs">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span>Invite Team Member</span>
          </h2>

          {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{error}</div>}

          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@company.com"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded transition"
            >
              {loading ? "Generating Invite..." : "Generate Invite"}
            </button>
          </form>

          {inviteResult && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <p className="font-semibold text-blue-900 mb-1">Invitation Token Generated!</p>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  readOnly
                  value={getInviteLink(inviteResult.token)}
                  className="flex-1 bg-white border border-blue-200 rounded px-2.5 py-1.5 text-xs text-gray-700 font-mono"
                />
                <button
                  onClick={() => copyToClipboard(getInviteLink(inviteResult.token))}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 text-xs text-gray-600 rounded">
          Note: Only Admins can invite new team members.
        </div>
      )}

      {/* Members List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 font-semibold text-xs text-gray-700 uppercase tracking-wider">
          Workspace Members ({members.length})
        </div>
        <div className="divide-y divide-gray-200">
          {members.map((m) => (
            <div key={m.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs">
                  {m.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900">{m.email}</div>
                  <div className="text-[10px] text-gray-400">ID: {m.id}</div>
                </div>
              </div>
              <div>
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                  m.role === "admin" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-100 text-gray-700"
                }`}>
                  {m.role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  <span className="capitalize">{m.role}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
