import React, { useEffect } from "react";
import { MessageSquare, CheckCircle, Code } from "lucide-react";
import { apiAuth } from "../services/api";

export default function DemoWidget() {
  useEffect(() => {
    const getBackendUrl = () => {
      if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
      if (typeof window !== "undefined") {
        if (window.location.port === "5173") return "http://localhost:8000";
        return window.location.origin;
      }
      return "http://localhost:8000";
    };

    const backendUrl = getBackendUrl();
    window.INTERCOM_BACKEND_URL = backendUrl;
    
    const user = apiAuth.getUser();
    if (user && user.workspace_id) {
      window.INTERCOM_WORKSPACE_ID = user.workspace_id;
    }

    const script = document.createElement("script");
    script.src = `${backendUrl}/static/widget.js`;
    script.async = true;
    document.body.appendChild(script);


    return () => {
      // Cleanup widget if unmounted
      const existingContainer = document.getElementById("intercom-widget-container");
      if (existingContainer) existingContainer.remove();
      window.IntercomWidgetLoaded = false;
    };
  }, []);

  const currentHost = typeof window !== "undefined" ? window.location.origin : "https://backend-domain";
  const embedCode = `<script src="${currentHost}/static/widget.js"></script>`;


  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-xs">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Live Chat Widget Demo</h1>
              <p className="text-xs text-gray-500">Test the floating live chat widget in action</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <p className="text-xs text-gray-700 leading-relaxed max-w-xl">
              Look at the <strong>bottom right corner</strong> of this page! You will see the floating blue chat bubble.
              Click it to open the chat window, send a message to support, view read receipts, typing indicators, or search Knowledge Base articles.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem("intercom_visitor_id");
                window.location.reload();
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-1.5 shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Start Fresh Conversation</span>
            </button>
          </div>


          <div className="border-t border-gray-200 pt-6 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-semibold text-gray-800">
              <Code className="w-4 h-4 text-blue-600" />
              <span>Embed Code for Customers</span>
            </div>
            <p className="text-xs text-gray-600">
              Customers simply paste this HTML snippet before the closing <code>&lt;/body&gt;</code> tag of their website:
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs font-mono select-all">
              {embedCode}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-gray-900">Widget Features Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-gray-900">Real-time WebSockets</strong>
                <span className="text-gray-500">Instant bidirectional messaging with low latency</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-gray-900">Visitor ID Persistence</strong>
                <span className="text-gray-500">Uses localStorage to remember visitor conversation history</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-gray-900">Typing & Read Indicators</strong>
                <span className="text-gray-500">Shows typing status and read checkmarks</span>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-gray-900">In-Widget KB Search</strong>
                <span className="text-gray-500">Instant search across published help center articles</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
