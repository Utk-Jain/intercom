import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { apiAuth } from "../services/api";
import { MessageSquare, Users, BookOpen, Settings, ExternalLink, LogOut, HelpCircle } from "lucide-react";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = apiAuth.getUser();

  const handleLogout = () => {
    apiAuth.logout();
    navigate("/login");
  };

  if (!user && !location.pathname.startsWith("/help") && location.pathname !== "/demo") {
    return null;
  }

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-6">
        <Link to="/dashboard" className="flex items-center space-x-2 text-blue-600 font-bold text-lg">
          <MessageSquare className="w-6 h-6" />
          <span>Intercom</span>
        </Link>

        {user && (
          <nav className="flex items-center space-x-1">
            <Link
              to="/dashboard"
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1.5 ${
                isActive("/dashboard") ? "bg-gray-100 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Inbox</span>
            </Link>

            <Link
              to="/team"
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1.5 ${
                isActive("/team") ? "bg-gray-100 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team</span>
            </Link>

            <Link
              to="/kb"
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1.5 ${
                isActive("/kb") ? "bg-gray-100 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Knowledge Base</span>
            </Link>

            <Link
              to="/settings"
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1.5 ${
                isActive("/settings") ? "bg-gray-100 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
          </nav>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <Link
              to={`/help/${user.workspace_id}`}
              target="_blank"
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center space-x-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Public Help</span>
            </Link>

            <Link
              to="/demo"
              target="_blank"
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center space-x-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Widget Demo</span>
            </Link>

            <div className="h-4 w-px bg-gray-200" />

            <div className="text-right">
              <div className="text-xs font-semibold text-gray-800">{user.email}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-500 hover:text-red-600 rounded-md hover:bg-gray-50"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex space-x-3 text-sm">
            <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium">Login</Link>
            <Link to="/signup" className="text-blue-600 font-semibold">Signup</Link>
          </div>
        )}
      </div>
    </header>
  );
}
