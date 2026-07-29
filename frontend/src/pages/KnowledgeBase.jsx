import React, { useState, useEffect } from "react";
import { apiKB, apiAuth } from "../services/api";
import { Plus, BookOpen, FolderPlus, Edit3, CheckCircle, EyeOff } from "lucide-react";

export default function KnowledgeBase() {
  const user = apiAuth.getUser();
  const isAdmin = user?.role === "admin";

  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);

  // Category Form
  const [newCatName, setNewCatName] = useState("");

  // Article Modal/Form State
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [published, setPublished] = useState(false);

  const loadData = async () => {
    try {
      const [arts, cats] = await Promise.all([apiKB.getArticles(), apiKB.getCategories()]);
      setArticles(arts);
      setCategories(cats);
    } catch (err) {
      console.error("Failed to load KB data:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await apiKB.createCategory(newCatName.trim());
      setNewCatName("");
      loadData();
    } catch (err) {
      alert("Failed to create category: " + err.message);
    }
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      if (editingArticleId) {
        await apiKB.updateArticle(editingArticleId, {
          title,
          content,
          category_id: categoryId || null,
          published,
        });
      } else {
        await apiKB.createArticle({
          title,
          content,
          category_id: categoryId || null,
          published,
        });
      }
      resetForm();
      loadData();
    } catch (err) {
      alert("Failed to save article: " + err.message);
    }
  };

  const startEdit = (art) => {
    setEditingArticleId(art.id);
    setTitle(art.title);
    setContent(art.content);
    setCategoryId(art.category_id || "");
    setPublished(art.published);
    setShowArticleForm(true);
  };

  const resetForm = () => {
    setEditingArticleId(null);
    setTitle("");
    setContent("");
    setCategoryId("");
    setPublished(false);
    setShowArticleForm(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Knowledge Base Management</h1>
          <p className="text-xs text-gray-500 mt-1">Create and publish support articles for your customers</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowArticleForm(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Article</span>
          </button>
        )}
      </div>

      {/* Category Creation Bar */}
      {isAdmin && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-700">
            <FolderPlus className="w-4 h-4 text-blue-600" />
            <span>Add Category</span>
          </div>
          <form onSubmit={handleCreateCategory} className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category Name (e.g. Billing, Setup)"
              className="border border-gray-300 rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded"
            >
              Add Category
            </button>
          </form>
        </div>
      )}

      {/* Article Form Modal / Section */}
      {showArticleForm && (
        <div className="bg-white border border-gray-300 rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            {editingArticleId ? "Edit Article" : "Create New Article"}
          </h2>
          <form onSubmit={handleSaveArticle} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="How to reset password..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Content</label>
              <textarea
                required
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the full help article content here..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="publish-check"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="publish-check" className="text-xs text-gray-700 font-medium">
                Publish Article immediately
              </label>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded"
              >
                Save Article
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Articles Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg">
            No articles created yet. Click "New Article" to get started.
          </div>
        ) : (
          articles.map((art) => (
            <div key={art.id} className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {art.category_name || "General"}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                    art.published ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                  }`}>
                    {art.published ? <CheckCircle className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{art.published ? "Published" : "Draft"}</span>
                  </span>
                </div>
                <h3 className="font-bold text-sm text-gray-900 mb-2">{art.title}</h3>
                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-4">{art.content}</p>
              </div>

              {isAdmin && (
                <div className="pt-3 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => startEdit(art)}
                    className="text-xs text-blue-600 hover:underline font-medium flex items-center space-x-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Article</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
