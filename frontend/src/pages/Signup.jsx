import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiAuth } from "../services/api";

export default function Signup() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let data;
      if (inviteToken) {
        data = await apiAuth.signupInvite({ email, password, token: inviteToken });
      } else {
        data = await apiAuth.signup({ email, password, workspace_name: workspaceName });
      }
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_info", JSON.stringify(data));
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {inviteToken ? "Join Team Workspace" : "Create Workspace"}
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          {inviteToken ? "Sign up to join your team" : "Set up your customer communication platform"}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!inviteToken && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Workspace Name</label>
              <input
                type="text"
                required
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Acme Support"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded text-sm transition"
          >
            {loading ? "Creating Account..." : inviteToken ? "Join Workspace" : "Get Started"}
          </button>
        </form>

        <p className="mt-6 text-xs text-center text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
