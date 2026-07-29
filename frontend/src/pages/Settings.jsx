import React, { useState, useEffect } from "react";
import { apiSettings } from "../services/api";
import { Globe, CheckCircle2, Clock, Info } from "lucide-react";

export default function Settings() {
  const [workspace, setWorkspace] = useState(null);
  const [customDomain, setCustomDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiSettings.get().then((data) => {
      setWorkspace(data);
      if (data.custom_domain) {
        setCustomDomain(data.custom_domain);
      }
    }).catch(console.error);
  }, []);

  const handleSaveDomain = async (e) => {
    e.preventDefault();
    if (!customDomain.trim()) return;
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const updated = await apiSettings.updateDomain(customDomain.trim());
      setWorkspace(updated);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to update custom domain");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Workspace Settings</h1>
          <p className="text-xs text-gray-500 mt-1">Configure your workspace custom domain and branding</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-xs">
        <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 mb-4">
          <Globe className="w-4 h-4 text-blue-600" />
          <span>Custom Domain</span>
        </div>

        {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{error}</div>}
        {success && <div className="mb-4 text-xs text-green-600 bg-green-50 p-2.5 rounded border border-green-200">Custom domain updated successfully!</div>}

        <form onSubmit={handleSaveDomain} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Domain Hostname</label>
            <div className="flex gap-3">
              <input
                type="text"
                required
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="help.company.com"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded transition"
              >
                {saving ? "Saving..." : "Save Domain"}
              </button>
            </div>
          </div>

          {workspace?.custom_domain && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs flex items-center justify-between">
              <div>
                <span className="text-gray-500">Configured Domain: </span>
                <span className="font-mono font-bold text-gray-800">{workspace.custom_domain}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                <Clock className="w-3 h-3" />
                <span>Pending Verification</span>
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  );

}
