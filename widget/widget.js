(function () {
  if (window.IntercomWidgetLoaded) return;
  window.IntercomWidgetLoaded = true;

  // Determine backend URL
  var scriptTag = document.currentScript;
  var backendUrl = window.INTERCOM_BACKEND_URL || (scriptTag ? new URL(scriptTag.src).origin : "http://localhost:8000");
  if (backendUrl.includes("localhost:") || backendUrl.includes("127.0.0.1:")) {
    backendUrl = "http://localhost:8000";
  }

  var wsUrl = backendUrl.replace(/^http/, "ws") + "/ws";

  // Visitor ID persistence
  var visitorId = localStorage.getItem("intercom_visitor_id");
  if (!visitorId) {
    visitorId = "visitor_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    localStorage.setItem("intercom_visitor_id", visitorId);
  }

  // Active workspace ID (if logged in, or null for default anonymous workspace)
  var workspaceId = window.INTERCOM_WORKSPACE_ID || null;
  if (!workspaceId) {
    try {
      var userInfo = localStorage.getItem("user_info");
      if (userInfo) {
        workspaceId = JSON.parse(userInfo).workspace_id;
      }
    } catch (e) { }
  }

  // Inject CSS
  var cssLink = document.createElement("link");
  cssLink.rel = "stylesheet";
  cssLink.href = backendUrl + "/static/widget.css";
  document.head.appendChild(cssLink);

  // Widget State
  var isChatOpen = false;
  var conversationId = null;
  var messages = [];
  var ws = null;
  var typingTimeout = null;
  var kbSearchTimeout = null;
  var appendedMsgIds = {};

  // Build DOM Structure
  var container = document.createElement("div");
  container.id = "intercom-widget-container";
  container.innerHTML = `
    <div id="intercom-chat-window" class="hidden">
      <div class="intercom-header">
        <div class="intercom-title">
          <span class="intercom-presence-dot" id="intercom-presence"></span>
          <div>
            <div>Support Chat</div>
            <div class="intercom-presence-text" id="intercom-presence-text">Team Online</div>
          </div>
        </div>
        <button class="intercom-close-btn" id="intercom-close-btn">&times;</button>
      </div>
      
      <div class="intercom-body" id="intercom-chat-body">
        <div class="intercom-msg agent">Hello! How can we help you today?</div>
      </div>

      <div class="intercom-typing-indicator" id="intercom-typing" style="display:none;">Agent is typing...</div>

      <!-- Suggested Help Articles Popup (appears above input when typing) -->
      <div class="intercom-kb-popup hidden" id="intercom-kb-popup">
        <div class="intercom-kb-popup-title">Suggested Articles</div>
        <div id="intercom-kb-results"></div>
      </div>

      <div class="intercom-footer" id="intercom-chat-footer">
        <input type="text" class="intercom-input" id="intercom-input" placeholder="Ask a question or type a message..." />
        <button class="intercom-send-btn" id="intercom-send-btn">Send</button>
      </div>
    </div>

    <div id="intercom-bubble">
      💬
    </div>
  `;
  document.body.appendChild(container);

  // UI Elements
  var bubble = document.getElementById("intercom-bubble");
  var chatWindow = document.getElementById("intercom-chat-window");
  var closeBtn = document.getElementById("intercom-close-btn");
  var chatBody = document.getElementById("intercom-chat-body");
  var input = document.getElementById("intercom-input");
  var sendBtn = document.getElementById("intercom-send-btn");
  var typingIndicator = document.getElementById("intercom-typing");
  var presenceDot = document.getElementById("intercom-presence");
  var presenceText = document.getElementById("intercom-presence-text");
  var kbPopup = document.getElementById("intercom-kb-popup");
  var kbResults = document.getElementById("intercom-kb-results");

  // Toggle Chat Window
  bubble.onclick = function () {
    isChatOpen = !isChatOpen;
    if (isChatOpen) {
      chatWindow.classList.remove("hidden");
      scrollToBottom();
    } else {
      chatWindow.classList.add("hidden");
    }
  };

  closeBtn.onclick = function () {
    isChatOpen = false;
    chatWindow.classList.add("hidden");
  };

  // Connect WebSocket
  function initWebSocket() {
    var fullWsUrl = wsUrl + "?visitor_id=" + visitorId + (workspaceId ? "&workspace_id=" + workspaceId : "");
    ws = new WebSocket(fullWsUrl);

    ws.onopen = function () {
      presenceDot.classList.remove("offline");
      presenceText.textContent = "Team Online";
      ws.send(JSON.stringify({ type: "presence", visitor_id: visitorId, workspace_id: workspaceId, status: "online" }));
    };

    ws.onmessage = function (event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === "chat_message") {
          var msg = data.message;
          if (msg && (msg.conversation_id === conversationId || data.conversation_id === conversationId)) {
            appendMessage(msg);
          }
        } else if (data.type === "typing") {
          if (data.visitor_id !== visitorId) {
            showTyping();
          }
        } else if (data.type === "read") {
          markReadReceipts();
        }
      } catch (e) {
        console.error("Widget WebSocket error:", e);
      }
    };

    ws.onclose = function () {
      presenceDot.classList.add("offline");
      presenceText.textContent = "Offline";
      setTimeout(initWebSocket, 3000);
    };
  }

  // Load Session History
  function initSession() {
    fetch(backendUrl + "/widget/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId, workspace_id: workspaceId }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        conversationId = data.conversation_id;
        workspaceId = data.workspace_id || workspaceId;
        messages = data.messages || [];
        renderMessages();
      })
      .catch(function (err) {
        console.error("Widget init error:", err);
      });
  }

  function renderMessages() {
    chatBody.innerHTML = `<div class="intercom-msg agent">Hello! How can we help you today?</div>`;
    appendedMsgIds = {};
    messages.forEach(function (m) {
      appendMessage(m, false);
    });
    scrollToBottom();
  }

  function appendMessage(msg, scroll) {
    if (!msg) return;
    if (msg.id && appendedMsgIds[msg.id]) return; // Prevent duplicate appends
    if (msg.id) appendedMsgIds[msg.id] = true;

    if (scroll === undefined) scroll = true;
    var msgDiv = document.createElement("div");
    var isCustomer = msg.sender === "customer";
    msgDiv.className = "intercom-msg " + (isCustomer ? "customer" : "agent");

    var timeStr = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    msgDiv.innerHTML = `
      <div>${escapeHtml(msg.body)}</div>
      <div class="intercom-msg-meta">
        ${timeStr} ${isCustomer ? '<span class="intercom-read-receipt">✓</span>' : ''}
      </div>
    `;

    chatBody.appendChild(msgDiv);
    if (scroll) scrollToBottom();
  }

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showTyping() {
    typingIndicator.style.display = "block";
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function () {
      typingIndicator.style.display = "none";
    }, 2500);
  }

  function markReadReceipts() {
    var checkmarks = chatBody.querySelectorAll(".intercom-read-receipt");
    checkmarks.forEach(function (el) {
      el.textContent = "✓✓";
      el.classList.add("read");
    });
  }

  // Send Message Logic
  function sendMessage() {
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    hideKbPopup();

    fetch(backendUrl + "/widget/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId, workspace_id: workspaceId, body: text }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (msg) {
        if (msg && msg.id) {
          appendMessage(msg);
        }
      })
      .catch(function (err) {
        console.error("Send message error:", err);
      });
  }

  sendBtn.onclick = sendMessage;

  // Real-time Input handler: Handles typing events + live Knowledge Base article suggestions
  input.oninput = function () {
    var q = input.value.trim();

    // 1. Send typing WebSocket event
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "typing", visitor_id: visitorId, workspace_id: workspaceId, conversation_id: conversationId }));
    }

    // 2. Debounced search for related Knowledge Base articles
    if (kbSearchTimeout) clearTimeout(kbSearchTimeout);
    if (!q || q.length < 2) {
      hideKbPopup();
      return;
    }

    kbSearchTimeout = setTimeout(function () {
      fetch(backendUrl + "/widget/articles?q=" + encodeURIComponent(q))
        .then(function (res) {
          return res.json();
        })
        .then(function (articles) {
          if (!articles || articles.length === 0) {
            hideKbPopup();
            return;
          }
          renderKbPopup(articles);
        })
        .catch(function () {
          hideKbPopup();
        });
    }, 250);
  };

  input.onkeypress = function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  function renderKbPopup(articles) {
    kbResults.innerHTML = articles
      .map(function (a) {
        return `
          <div class="intercom-article-item" data-id="${a.id}">
            <div class="intercom-article-item-title">📖 ${escapeHtml(a.title)}</div>
            <div class="intercom-article-item-snippet">${escapeHtml(a.content)}</div>
          </div>
        `;
      })
      .join("");

    // Attach click listeners to suggested articles
    var items = kbResults.querySelectorAll(".intercom-article-item");
    items.forEach(function (item, idx) {
      item.onclick = function () {
        var art = articles[idx];
        hideKbPopup();
        // Insert article answer directly into chat as helpful info
        var botAnswer = {
          id: "kb_" + art.id + "_" + Date.now(),
          sender: "agent",
          body: `💡 Help Article: ${art.title}\n\n${art.content}`,
          created_at: new Date().toISOString()
        };
        appendMessage(botAnswer);
        input.value = "";
      };
    });

    kbPopup.classList.remove("hidden");
  }

  function hideKbPopup() {
    kbPopup.classList.add("hidden");
    kbResults.innerHTML = "";
  }

  // Initialize
  initSession();
  initWebSocket();
})();
