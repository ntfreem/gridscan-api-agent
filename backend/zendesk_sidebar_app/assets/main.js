/* BitBot Pro — Zendesk Sidebar App (ZAF v2) */

(function () {
  "use strict";

  var client = ZAFClient.init();
  if (!client) return;

  // ── State ──
  var currentTicketId = null;
  var currentSuggestion = null;
  var isGenerating = false;
  var bitbotUrl = "";
  var sidebarApiKey = "";

  // ── DOM refs ──
  var stateInitial = document.getElementById("state-initial");
  var stateLoading = document.getElementById("state-loading");
  var stateResult = document.getElementById("state-result");
  var stateError = document.getElementById("state-error");
  var stateNotConfigured = document.getElementById("state-not-configured");
  var btnGenerate = document.getElementById("btn-generate");
  var btnInsert = document.getElementById("btn-insert");
  var btnCopy = document.getElementById("btn-copy");
  var btnRegenerate = document.getElementById("btn-regenerate");
  var btnRetry = document.getElementById("btn-retry");
  var suggestionText = document.getElementById("suggestion-text");
  var ticketBadge = document.getElementById("ticket-badge");
  var lowConfBanner = document.getElementById("low-confidence-banner");
  var errorMessage = document.getElementById("error-message");
  var insertFeedback = document.getElementById("insert-feedback");
  var statusDot = document.getElementById("status-dot");

  // ── Helpers ──
  function showState(name) {
    [stateInitial, stateLoading, stateResult, stateError, stateNotConfigured].forEach(function (el) {
      el.classList.add("hidden");
    });
    var map = {
      initial: stateInitial,
      loading: stateLoading,
      result: stateResult,
      error: stateError,
      "not-configured": stateNotConfigured,
    };
    if (map[name]) map[name].classList.remove("hidden");
    client.invoke("resize", { width: "100%", height: getHeight(name) });
  }

  function getHeight(state) {
    switch (state) {
      case "loading": return "200px";
      case "error": return "200px";
      case "not-configured": return "200px";
      default: return "600px";
    }
  }

  function setStatus(type) {
    statusDot.className = "status-dot status-" + type;
    statusDot.title = type === "ready" ? "Ready" : type === "busy" ? "Generating..." : type === "ok" ? "Done" : "Error";
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function showFeedback(msg, type) {
    insertFeedback.textContent = msg;
    insertFeedback.className = "feedback feedback-" + type;
    setTimeout(function () {
      insertFeedback.className = "feedback hidden";
    }, 3000);
  }

  // ── Init ──
  client.metadata().then(function (meta) {
    bitbotUrl = (meta.settings.bitbot_url || "").replace(/\/+$/, "");
    sidebarApiKey = meta.settings.sidebar_api_key || "";

    if (!bitbotUrl || !sidebarApiKey) {
      showState("not-configured");
      return;
    }

    // Get current ticket
    client.get("ticket.id").then(function (data) {
      currentTicketId = data["ticket.id"];
      if (currentTicketId) {
        ticketBadge.textContent = "#" + currentTicketId;
      }
      showState("initial");
    });
  });

  // ── Ticket switch detection ──
  client.on("ticket.id.changed", function (data) {
    var newId = data || null;
    // The value may come wrapped
    if (typeof data === "object" && data !== null) {
      newId = data["ticket.id"] || data.id || null;
    }
    if (newId && String(newId) !== String(currentTicketId)) {
      currentTicketId = String(newId);
      currentSuggestion = null;
      ticketBadge.textContent = "#" + currentTicketId;
      showState("initial");
      setStatus("ready");
    }
  });

  // ── Generate ──
  function generate() {
    if (isGenerating || !currentTicketId) return;
    isGenerating = true;
    currentSuggestion = null;
    setStatus("busy");
    showState("loading");

    var requestTicketId = String(currentTicketId);

    fetch(bitbotUrl + "/api/zendesk/sidebar/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sidebar-Key": sidebarApiKey,
      },
      body: JSON.stringify({ ticket_id: requestTicketId }),
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (err) {
            throw new Error(err.detail || "Request failed (" + resp.status + ")");
          }).catch(function (e) {
            if (e.message) throw e;
            throw new Error("Request failed (" + resp.status + ")");
          });
        }
        return resp.json();
      })
      .then(function (data) {
        isGenerating = false;
        // Guard: if ticket changed while generating, discard
        if (String(currentTicketId) !== requestTicketId) {
          return;
        }

        currentSuggestion = data.suggestion;
        suggestionText.innerHTML = formatSuggestion(data.suggestion);
        ticketBadge.textContent = "#" + data.ticket_id;

        if (data.low_confidence) {
          lowConfBanner.classList.remove("hidden");
        } else {
          lowConfBanner.classList.add("hidden");
        }

        setStatus("ok");
        showState("result");
      })
      .catch(function (err) {
        isGenerating = false;
        if (String(currentTicketId) !== requestTicketId) return;
        errorMessage.textContent = err.message || "Something went wrong.";
        setStatus("error");
        showState("error");
      });
  }

  function formatSuggestion(text) {
    if (!text) return "<em>No suggestion generated.</em>";
    // Basic markdown-ish rendering: bold, line breaks
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\n/g, "<br>");
    return escaped;
  }

  // ── Insert into reply ──
  function insertIntoReply() {
    if (!currentSuggestion) return;
    // Use comment.appendText to add to the reply editor
    client.invoke("comment.appendText", currentSuggestion).then(function () {
      showFeedback("Inserted into reply editor", "success");
    }).catch(function () {
      // Fallback: try appendHtml
      var html = "<p>" + escapeHtml(currentSuggestion).replace(/\n/g, "</p><p>") + "</p>";
      client.invoke("comment.appendHtml", html).then(function () {
        showFeedback("Inserted into reply editor", "success");
      }).catch(function () {
        showFeedback("Could not insert — try copying instead", "error");
      });
    });
  }

  // ── Copy ──
  function copyToClipboard() {
    if (!currentSuggestion) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentSuggestion).then(function () {
        showFeedback("Copied to clipboard", "success");
        btnCopy.querySelector("svg + span") && (btnCopy.innerHTML = btnCopy.innerHTML);
      }).catch(function () {
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
  }

  function fallbackCopy() {
    var ta = document.createElement("textarea");
    ta.value = currentSuggestion;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showFeedback("Copied to clipboard", "success");
    } catch (e) {
      showFeedback("Copy failed — select text manually", "error");
    }
    document.body.removeChild(ta);
  }

  // ── Event listeners ──
  btnGenerate.addEventListener("click", generate);
  btnRegenerate.addEventListener("click", generate);
  btnRetry.addEventListener("click", generate);
  btnInsert.addEventListener("click", insertIntoReply);
  btnCopy.addEventListener("click", copyToClipboard);
})();
