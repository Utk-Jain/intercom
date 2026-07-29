import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { apiKB } from "../services/api";
import { Search, BookOpen, ChevronRight, HelpCircle } from "lucide-react";

export default function PublicHelp() {
  const { workspaceId } = useParams();
  const [data, setData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHelpData = async () => {
    setLoading(true);
    try {
      const res = await apiKB.getPublicHelp(workspaceId, searchQuery, selectedCategory);
      setData(res);
    } catch (err) {
      console.error("Failed to load help center:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHelpData();
  }, [workspaceId, selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchHelpData();
  };

  if (loading && !data) {
    return <div className="min-h-screen flex items-center justify-center text-xs text-gray-500">Loading Help Center...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header Banner */}
      <div className="bg-white border-b border-gray-200 py-12 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center space-x-2 text-blue-600 font-bold text-lg">
            <HelpCircle className="w-6 h-6" />
            <span>{data?.workspace_name || "Help Center"}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">How can we help you?</h1>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for articles, guides..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-5 py-2 rounded-lg"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto py-8 px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Categories */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Categories</h2>
          <div className="space-y-1">
            <button
              onClick={() => { setSelectedCategory(""); setSelectedArticle(null); }}
              className={`w-full text-left px-3 py-2 text-xs rounded-md font-medium transition ${
                !selectedCategory ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              All Articles
            </button>
            {data?.categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSelectedArticle(null); }}
                className={`w-full text-left px-3 py-2 text-xs rounded-md font-medium transition ${
                  selectedCategory === cat.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3">
          {selectedArticle ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-xs">
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-xs text-blue-600 hover:underline mb-4 font-medium inline-block"
              >
                ← Back to articles
              </button>
              <div className="text-[10px] uppercase font-semibold text-blue-600 mb-2">
                {selectedArticle.category_name}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedArticle.title}</h2>
              <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {selectedArticle.content}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {selectedCategory ? "Articles in Category" : "Published Articles"} ({data?.articles?.length || 0})
              </h2>

              {data?.articles?.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-xs text-gray-500">
                  No articles found matching your criteria.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 bg-white border border-gray-200 rounded-lg overflow-hidden">
                  {data?.articles?.map((art) => (
                    <div
                      key={art.id}
                      onClick={() => setSelectedArticle(art)}
                      className="p-5 hover:bg-gray-50 cursor-pointer flex items-center justify-between group transition"
                    >
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-gray-400 block mb-1">
                          {art.category_name}
                        </span>
                        <h3 className="font-bold text-sm text-gray-900 group-hover:text-blue-600 mb-1">
                          {art.title}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2">{art.content}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0 ml-4" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
