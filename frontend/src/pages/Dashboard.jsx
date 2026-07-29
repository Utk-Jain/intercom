import React, { useState, useEffect, useRef } from "react";
import { apiConversations, apiUsers, apiAI, apiAuth } from "../services/api";
import { MessageSquare, Mail, UserCheck, RefreshCw, Send, Sparkles, Filter, CheckCheck } from "lucide-react";

export default function Dashboard() {
  const currentUser = apiAuth.getUser();
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [members, setMembers] = useState([]);

  // Filters
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");

  // Messages & Reply Input
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // Typing & Read States
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // AI Summary State
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  // Fetch Team Members
  useEffect(() => {
    apiUsers.getMembers().then(setMembers).catch(console.error);
  }, []);

  // Fetch Conversations
  const loadConversations = async () => {
    try {
      const data = await apiConversations.list({
        channel: channelFilter || undefined,
        status: statusFilter || undefined,
      });
      setConversations(data);
      if (data.length > 0 && !selectedConvId) {
        setSelectedConvId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [channelFilter, statusFilter]);

  // Fetch Active Conversation Details & AI Summary
  useEffect(() => {
    if (!selectedConvId) return;

    apiConversations.get(selectedConvId).then((data) => {
      setActiveConv(data);
      loadSummary(data.id);
      
      // Send Read receipt via WS when conversation is loaded by agent
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "read",
          workspace_id: currentUser?.workspace_id,
          conversation_id: data.id,
          user_id: currentUser?.user_id
        }));
      }
    }).catch(console.error);
  }, [selectedConvId]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  // WebSocket Subscription for Realtime Inbox Updates, Typing, Read Receipts
  useEffect(() => {
    if (!currentUser) return;
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const wsUrl = backendUrl.replace(/^http/, "ws") + `/ws?workspace_id=${currentUser.workspace_id}&user_id=${currentUser.user_id}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat_message" || data.type === "conversation_updated") {
          loadConversations();
          if (selectedConvId && (data.conversation_id === selectedConvId || data.message?.conversation_id === selectedConvId)) {
            apiConversations.get(selectedConvId).then(setActiveConv).catch(console.error);
          }
        } else if (data.type === "typing") {
          if (data.visitor_id && data.conversation_id === selectedConvId) {
            setIsCustomerTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsCustomerTyping(false), 2500);
          }
        }
      } catch (err) {
        console.error("Dashboard WS error:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [currentUser, selectedConvId]);

  const loadSummary = async (convId) => {
    setSummaryLoading(true);
    setSummary("");
    try {
      const data = await apiAI.getSummary(convId);
      setSummary(data.summary);
    } catch (err) {
      setSummary("Could not load AI summary.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleReplyTyping = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        workspace_id: currentUser?.workspace_id,
        user_id: currentUser?.user_id,
        conversation_id: selectedConvId
      }));
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConvId || sending) return;

    setSending(true);
    try {
      await apiConversations.sendMessage(selectedConvId, replyText.trim());
      setReplyText("");
      const updated = await apiConversations.get(selectedConvId);
      setActiveConv(updated);
      loadConversations();
    } catch (err) {
      alert("Failed to send message: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedConvId) return;
    try {
      await apiConversations.update(selectedConvId, { status: newStatus });
      loadConversations();
      const updated = await apiConversations.get(selectedConvId);
      setActiveConv(updated);
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleAssign = async (assigneeId) => {
    if (!selectedConvId) return;
    try {
      await apiConversations.update(selectedConvId, { assignee_id: assigneeId });
      loadConversations();
      const updated = await apiConversations.get(selectedConvId);
      setActiveConv(updated);
    } catch (err) {
      alert("Failed to assign conversation: " + err.message);
    }
  };

  return (
    <div className="flex h-[calc(100vh-57px)] bg-white">
      {/* Sidebar / Conversation List */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        {/* Filters Header */}
        <div className="p-4 border-b border-gray-200 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-gray-900 text-sm">Unified Inbox</h1>
            <button onClick={loadConversations} className="p-1 text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Status Filters */}
          <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200">
            {["open", "snoozed", "resolved", ""].map((st) => (
              <button
                key={st || "all"}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 py-1 text-xs capitalize rounded font-medium ${
                  statusFilter === st ? "bg-white text-blue-600 shadow-xs" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {st || "All"}
              </button>
            ))}
          </div>

          {/* Channel Filters */}
          <div className="flex items-center space-x-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <button
              onClick={() => setChannelFilter("")}
              className={`px-2 py-0.5 rounded ${!channelFilter ? "bg-blue-100 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-100"}`}
            >
              All
            </button>
            <button
              onClick={() => setChannelFilter("chat")}
              className={`px-2 py-0.5 rounded flex items-center space-x-1 ${channelFilter === "chat" ? "bg-blue-100 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setChannelFilter("email")}
              className={`px-2 py-0.5 rounded flex items-center space-x-1 ${channelFilter === "email" ? "bg-blue-100 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <Mail className="w-3 h-3" />
              <span>Email</span>
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No conversations found</div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3.5 cursor-pointer border-l-4 transition ${
                    isSelected
                      ? "bg-white border-blue-600 shadow-xs"
                      : "border-transparent hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-gray-900 truncate max-w-[150px]">
                      {conv.visitor_id || conv.email_thread_id || "Customer"}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider flex items-center gap-1.5 border ${
                      conv.channel === "chat"
                        ? "bg-purple-100 text-purple-700 border-purple-200"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                    }`}>
                      {conv.channel === "chat" ? <MessageSquare className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                      <span>{conv.channel}</span>
                    </span>

                  </div>

                  <p className="text-xs text-gray-600 truncate mb-2">
                    {conv.latest_message ? conv.latest_message.body : conv.subject || "New Conversation"}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span className={`capitalize px-1.5 py-0.2 rounded text-[10px] font-medium ${
                      conv.status === "open" ? "bg-green-50 text-green-700" :
                      conv.status === "snoozed" ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {conv.status}
                    </span>
                    <span>{conv.assignee_email ? conv.assignee_email.split("@")[0] : "Unassigned"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Conversation Panel */}
      {activeConv ? (
        <div className="flex-1 flex flex-col h-full bg-white">
          {/* Header */}
          <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between bg-white">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm text-gray-900">
                  {activeConv.subject || activeConv.visitor_id || "Conversation Thread"}
                </h2>
                <span className="text-xs text-gray-400">({activeConv.channel})</span>
              </div>
              <p className="text-xs text-gray-500">ID: {activeConv.id}</p>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={activeConv.assignee_id || ""}
                  onChange={(e) => handleAssign(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => handleUpdateStatus("open")}
                className={`px-2.5 py-1 rounded text-xs border ${
                  activeConv.status === "open" ? "bg-green-50 border-green-300 text-green-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Open
              </button>
              <button
                onClick={() => handleUpdateStatus("snoozed")}
                className={`px-2.5 py-1 rounded text-xs border ${
                  activeConv.status === "snoozed" ? "bg-yellow-50 border-yellow-300 text-yellow-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Snooze
              </button>
              <button
                onClick={() => handleUpdateStatus("resolved")}
                className={`px-2.5 py-1 rounded text-xs border ${
                  activeConv.status === "resolved" ? "bg-gray-100 border-gray-300 text-gray-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                Resolve
              </button>
            </div>
          </div>

          {/* AI Summary Banner */}
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-1.5 text-blue-900 font-semibold text-xs">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>AI Conversation Summary (Groq)</span>
              </div>
              <button
                onClick={() => loadSummary(activeConv.id)}
                disabled={summaryLoading}
                className="text-[11px] text-blue-600 hover:underline flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${summaryLoading ? "animate-spin" : ""}`} />
                <span>Regenerate</span>
              </button>
            </div>

            {summaryLoading ? (
              <div className="text-xs text-blue-700 italic">Generating summary...</div>
            ) : (
              <div className="text-xs text-blue-900 whitespace-pre-wrap font-sans leading-relaxed">
                {summary}
              </div>
            )}
          </div>

          {/* Full Message History Thread (Both Users' Messages) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
            {activeConv.messages && activeConv.messages.length > 0 ? (
              activeConv.messages.map((msg) => {
                const isAgent = msg.sender === "agent" || msg.sender === "admin";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isAgent ? "items-end" : "items-start"}`}
                  >
                    <div className="text-[10px] text-gray-400 mb-1 font-semibold flex items-center gap-1">
                      <span>{isAgent ? `Agent (${msg.sender})` : `Customer (${activeConv.visitor_id || "Visitor"})`}</span>
                      <span>•</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isAgent && <CheckCheck className="w-3 h-3 text-blue-500 ml-0.5" />}
                    </div>
                    <div
                      className={`max-w-xl px-4 py-2.5 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                        isAgent
                          ? "bg-blue-600 text-white rounded-br-none shadow-xs"
                          : "bg-white text-gray-900 border border-gray-200 rounded-bl-none shadow-xs"
                      }`}
                    >
                      {msg.body}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-xs text-gray-400 my-8">No messages in this conversation yet.</div>
            )}

            {/* Live Typing Indicator */}
            {isCustomerTyping && (
              <div className="text-xs text-gray-500 italic bg-gray-100 px-3 py-1.5 rounded-full inline-block animate-pulse">
                Customer is typing...
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Agent Reply Form */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex space-x-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => {
                setReplyText(e.target.value);
                handleReplyTyping();
              }}
              placeholder={activeConv.channel === "email" ? "Type email reply..." : "Type chat message reply..."}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={sending || !replyText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-medium flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? "Sending..." : "Reply"}</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
          Select a conversation from the left to view thread
        </div>
      )}
    </div>
  );
}
