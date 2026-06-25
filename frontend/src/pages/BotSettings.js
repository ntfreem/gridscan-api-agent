import { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Save, Eye, EyeOff, Plus, X, ExternalLink, MessageSquare, Lightbulb, Cpu, Zap } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

export default function BotSettings() {
  const { selectedInstance } = useAuth();
  const instanceId = selectedInstance?.id;
  const [config, setConfig] = useState({ name: "", persona: "", custom_instructions: "", tone_instructions: "", manual_tone_examples: [] });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [newEx, setNewEx] = useState({ label: "", user_msg: "", bot_msg: "" });
  const [showAddForm, setShowAddForm] = useState(false);

  // LLM provider per-instance configuration
  const [llm, setLlm] = useState({
    provider: "emergent",
    model: "",
    anthropic_api_key: "",
    ollama_base_url: "",
    anthropic_api_key_set: false,
    anthropic_api_key_preview: "",
    allowed_anthropic_models: ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"],
    default_models: { emergent: "claude-sonnet-4-5-20251101", anthropic: "claude-sonnet-4-5", ollama: "llama3.1" },
  });
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState(null);

  useEffect(() => {
    if (!instanceId) return;
    api.get(`/admin/instances/${instanceId}/llm-config`).then(r => {
      if (r.data) setLlm(p => ({ ...p, ...r.data, anthropic_api_key: "" }));
    }).catch(() => {});
  }, [instanceId]);

  const saveLlm = async () => {
    const payload = {
      provider: llm.provider,
      model: llm.model || null,
      // Send key only if the admin typed a new one; backend preserves existing on empty
      anthropic_api_key: llm.anthropic_api_key.trim() || null,
      ollama_base_url: llm.ollama_base_url || null,
    };
    setLlmSaving(true); setLlmTestResult(null);
    try {
      await api.put(`/admin/instances/${instanceId}/llm-config`, payload);
      toast.success(`Provider saved: ${llm.provider}`);
      // Reload to refresh masked key preview
      const r = await api.get(`/admin/instances/${instanceId}/llm-config`);
      if (r.data) setLlm(p => ({ ...p, ...r.data, anthropic_api_key: "" }));
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save LLM config");
    } finally { setLlmSaving(false); }
  };

  const testLlm = async () => {
    setLlmTesting(true); setLlmTestResult(null);
    try {
      const r = await api.post(`/admin/instances/${instanceId}/llm-config/test`);
      setLlmTestResult(r.data);
      if (r.data?.success) toast.success(`Ping ok → ${r.data.response?.slice(0, 60)}`);
      else toast.error(`Ping failed: ${r.data?.error?.slice(0, 80)}`);
    } catch (e) {
      const err = e.response?.data?.detail || e.message;
      setLlmTestResult({ success: false, error: err });
      toast.error(`Ping failed: ${err}`);
    } finally { setLlmTesting(false); }
  };

  useEffect(() => {
    api.get(`/admin/bot-config`).then(r => {
      if (r.data) setConfig({ name: r.data.name || "", persona: r.data.persona || "", custom_instructions: r.data.custom_instructions || "", tone_instructions: r.data.tone_instructions || "", manual_tone_examples: r.data.manual_tone_examples || [] });
    }).catch(() => {});
    api.get(`/analytics/overview`).then(r => setApprovedCount(r.data?.approved_for_training ?? 0)).catch(() => {});
  }, [instanceId]);

  const save = async () => {
    if (!config.name.trim()) { toast.error("Bot name is required"); return; }
    if (!config.persona.trim()) { toast.error("Persona description is required"); return; }
    setSaving(true);
    try { await api.put(`/admin/bot-config`, config); toast.success("Settings saved"); } catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  };

  const addExample = () => {
    if (!newEx.user_msg.trim() || !newEx.bot_msg.trim()) { toast.error("Both user message and bot response are required"); return; }
    setConfig(p => ({ ...p, manual_tone_examples: [...(p.manual_tone_examples || []), { id: Date.now().toString(), ...newEx }] }));
    setNewEx({ label: "", user_msg: "", bot_msg: "" });
    setShowAddForm(false);
    toast.success("Example added \u2014 remember to save");
  };

  const removeExample = (index) => {
    setConfig(p => ({ ...p, manual_tone_examples: p.manual_tone_examples.filter((_, i) => i !== index) }));
    toast.success("Example removed \u2014 remember to save");
  };

  const totalToneExamples = (config.manual_tone_examples?.length || 0) + approvedCount;

  const systemPromptPreview = [
    `You are ${config.name || "[Bot Name]"}. ${config.persona || "[Persona]"}`,
    `KNOWLEDGE BASE \u2014 AUTHORITATIVE SOURCE:\n[Verified knowledge snippets injected here at runtime]\n\u2192 Bot answers these with full confidence, no hedging`,
    config.tone_instructions || config.manual_tone_examples?.length
      ? `COMMUNICATION STYLE \u2014 MATCH THIS PRECISELY\n${config.tone_instructions ? `Tone guide: ${config.tone_instructions}\n` : ""}[${config.manual_tone_examples?.length || 0} crafted examples + ${approvedCount} approved conversations injected here]`
      : null,
    config.custom_instructions ? `ADDITIONAL INSTRUCTIONS:\n${config.custom_instructions}` : null,
  ].filter(Boolean).join("\n\n");

  return (
    <div style={T.page}>
      <p style={T.overline}>Configuration</p>
      <h1 style={T.h1}>Bot Settings</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* LEFT */}
        <div>
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <p style={T.sectionTitle}>Identity</p>
            <p style={T.sectionSub}>Define who the bot is and how it presents itself.</p>
            <div style={{ marginBottom: "18px" }}>
              <label style={T.label}>Bot Name *</label>
              <input style={T.input} value={config.name} onChange={e => setConfig(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Aria, SupportBot, Max" data-testid="bot-name-input" onFocus={onFocus} onBlur={onBlur} />
              <p style={T.hint}>How the bot introduces itself.</p>
            </div>
            <div>
              <label style={T.label}>Persona *</label>
              <textarea style={{ ...T.textarea, minHeight: "110px" }} value={config.persona}
                onChange={e => setConfig(p => ({ ...p, persona: e.target.value }))}
                placeholder="You are a helpful customer support assistant for [Company]..."
                data-testid="bot-persona-input" onFocus={onFocus} onBlur={onBlur} />
              <p style={T.hint}>Core personality, role, and expertise area.</p>
            </div>
          </div>

          <div style={{ ...T.card, marginBottom: "20px" }}>
            <p style={T.sectionTitle}>Custom Instructions</p>
            <p style={T.sectionSub}>Guardrails and rules that always apply.</p>
            <textarea style={{ ...T.textarea, minHeight: "100px" }} value={config.custom_instructions}
              onChange={e => setConfig(p => ({ ...p, custom_instructions: e.target.value }))}
              placeholder="Always respond in English. Never share pricing without directing to sales..."
              data-testid="bot-instructions-input" onFocus={onFocus} onBlur={onBlur} />
            <p style={T.hint}>These rules override everything else.</p>
          </div>

          {/* ── LLM Provider — per-instance routing ── */}
          <div data-testid="llm-provider-card" style={{ ...T.card, marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Cpu size={14} color={colors.brand.light} />
              <p style={{ ...T.sectionTitle, margin: 0 }}>LLM Provider</p>
            </div>
            <p style={T.sectionSub}>Pick where this instance&apos;s AI calls go. <strong>Emergent</strong> uses the platform&apos;s Universal Key (default). <strong>Anthropic Direct</strong> bills against your own Anthropic account. <strong>Ollama</strong> calls a self-hosted model.</p>

            <label style={T.label}>Provider</label>
            <select
              value={llm.provider}
              onChange={e => setLlm(p => ({ ...p, provider: e.target.value, model: "" }))}
              data-testid="llm-provider-select"
              style={{ ...T.input, cursor: "pointer" }}
            >
              <option value="emergent">Emergent Universal Key (default)</option>
              <option value="anthropic">Anthropic Direct (BYO key)</option>
              <option value="ollama">Ollama (self-hosted)</option>
            </select>

            <label style={{ ...T.label, marginTop: "14px" }}>Model</label>
            {llm.provider === "anthropic" ? (
              <select
                value={llm.model || ""}
                onChange={e => setLlm(p => ({ ...p, model: e.target.value }))}
                data-testid="llm-model-select"
                style={{ ...T.input, cursor: "pointer" }}
              >
                <option value="">{`Default (${llm.default_models?.anthropic})`}</option>
                {(llm.allowed_anthropic_models || []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                value={llm.model || ""}
                onChange={e => setLlm(p => ({ ...p, model: e.target.value }))}
                placeholder={llm.provider === "ollama" ? "e.g. llama3.1, mistral" : `Default: ${llm.default_models?.emergent}`}
                data-testid="llm-model-input"
                onFocus={onFocus} onBlur={onBlur}
                style={T.input}
              />
            )}
            <p style={T.hint}>
              {llm.provider === "anthropic" && "Allowed: Haiku 4.5 (cheapest), Sonnet 4.5 (balanced), Opus 4.5 (best quality)."}
              {llm.provider === "emergent" && "Anthropic model name. Leave blank to use Opus → Sonnet fallback."}
              {llm.provider === "ollama" && "Any model installed on your Ollama server."}
            </p>

            {llm.provider === "anthropic" && (
              <>
                <label style={{ ...T.label, marginTop: "14px" }}>Anthropic API Key</label>
                <input
                  type="password"
                  value={llm.anthropic_api_key}
                  onChange={e => setLlm(p => ({ ...p, anthropic_api_key: e.target.value }))}
                  placeholder={llm.anthropic_api_key_set ? `Current: ${llm.anthropic_api_key_preview} — leave blank to keep` : "sk-ant-…"}
                  autoComplete="new-password"
                  data-testid="llm-anthropic-key-input"
                  onFocus={onFocus} onBlur={onBlur}
                  style={T.input}
                />
                <p style={T.hint}>
                  Get a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: colors.brand.light }}>console.anthropic.com</a>. Leave blank to keep the existing saved key.
                </p>
              </>
            )}

            {llm.provider === "ollama" && (
              <>
                <label style={{ ...T.label, marginTop: "14px" }}>Ollama Base URL</label>
                <input
                  value={llm.ollama_base_url}
                  onChange={e => setLlm(p => ({ ...p, ollama_base_url: e.target.value }))}
                  placeholder="http://localhost:11434"
                  data-testid="llm-ollama-url-input"
                  onFocus={onFocus} onBlur={onBlur}
                  style={T.input}
                />
                <p style={T.hint}>Where your Ollama server is reachable from the BridgeBot backend. Leave blank to fall back to <code>OLLAMA_BASE_URL</code> env (default localhost:11434).</p>
              </>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "14px", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={saveLlm} disabled={llmSaving} data-testid="llm-save-btn"
                style={{ ...T.btnPrimary, opacity: llmSaving ? 0.6 : 1 }}>
                <Save size={13} /> {llmSaving ? "Saving…" : "Save Provider"}
              </button>
              <button onClick={testLlm} disabled={llmTesting} data-testid="llm-test-btn"
                style={{ ...T.btnSecondary, opacity: llmTesting ? 0.6 : 1 }}>
                <Zap size={13} /> {llmTesting ? "Pinging…" : "Test Connection"}
              </button>
              {llmTestResult && (
                <span data-testid="llm-test-result" style={{
                  fontFamily: fonts.mono, fontSize: "11px",
                  color: llmTestResult.success ? "#22c55e" : colors.brand.error,
                  backgroundColor: llmTestResult.success ? "rgba(34,197,94,0.08)" : "rgba(244,63,94,0.08)",
                  padding: "5px 9px", borderRadius: "6px",
                  border: `1px solid ${llmTestResult.success ? "rgba(34,197,94,0.3)" : "rgba(244,63,94,0.3)"}`,
                }}>
                  {llmTestResult.success ? `✓ ${(llmTestResult.response || "").slice(0, 60)}` : `✗ ${(llmTestResult.error || "").slice(0, 60)}`}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={save} disabled={saving} data-testid="save-settings-btn"
              style={{ ...T.btnPrimary, opacity: saving ? 0.6 : 1 }}>
              <Save size={13} /> {saving ? "Saving..." : "Save All Settings"}
            </button>
            <button onClick={() => setShowPreview(!showPreview)} data-testid="toggle-preview-btn"
              style={T.btnSecondary}>
              {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
              {showPreview ? "Hide Preview" : "Preview Prompt"}
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div style={{ ...T.card, marginBottom: "20px" }}>
            <p style={T.sectionTitle}>Tone Training</p>
            <p style={T.sectionSub}>Teach the bot exactly how to speak.</p>

            <div style={{ marginBottom: "20px" }}>
              <label style={T.label}>Tone Description</label>
              <textarea style={{ ...T.textarea, minHeight: "80px" }} value={config.tone_instructions}
                onChange={e => setConfig(p => ({ ...p, tone_instructions: e.target.value }))}
                placeholder="Be concise and direct. Use casual, friendly language..."
                data-testid="tone-instructions-input" onFocus={onFocus} onBlur={onBlur} />
              <p style={T.hint}>Plain-English description of the desired voice.</p>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ ...T.label, margin: 0 }}>
                  Crafted Examples <span style={{ marginLeft: "8px", fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>{config.manual_tone_examples?.length || 0}</span>
                </label>
                <button onClick={() => setShowAddForm(!showAddForm)} data-testid="add-tone-example-btn"
                  style={T.btnGhost}>
                  <Plus size={11} /> Add Example
                </button>
              </div>
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, marginBottom: "12px", marginTop: 0 }}>
                Write ideal user/bot exchanges to show Claude exactly what "good" looks like.
              </p>

              {(config.manual_tone_examples || []).map((ex, i) => (
                <div key={ex.id || i} style={{
                  backgroundColor: colors.bg.base, border: `1px solid ${colors.border.subtle}`, borderRadius: "10px",
                  padding: "12px", marginBottom: "8px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {ex.label || `Example ${i + 1}`}
                    </span>
                    <button onClick={() => removeExample(i)} data-testid="remove-example-btn"
                      style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.muted, padding: "2px", display: "flex" }}
                      onMouseEnter={e => e.currentTarget.style.color = colors.brand.error}
                      onMouseLeave={e => e.currentTarget.style.color = colors.text.muted}>
                      <X size={12} />
                    </button>
                  </div>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: "0 0 5px", lineHeight: "1.5" }}>
                    <span style={{ color: colors.brand.blue, fontWeight: "500" }}>User: </span>{ex.user_msg}
                  </p>
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, lineHeight: "1.5" }}>
                    <span style={{ color: colors.brand.success, fontWeight: "500" }}>Bot: </span>{ex.bot_msg}
                  </p>
                </div>
              ))}

              {showAddForm && (
                <div style={{ backgroundColor: colors.bg.base, border: `1px dashed ${colors.border.default}`, borderRadius: "10px", padding: "14px", marginBottom: "10px" }}>
                  <p style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.secondary, textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 12px" }}>
                    New Example Exchange
                  </p>
                  <input value={newEx.label} onChange={e => setNewEx(p => ({ ...p, label: e.target.value }))}
                    placeholder="Label (optional)" style={{ ...T.input, marginBottom: "8px", fontSize: "12px" }} onFocus={onFocus} onBlur={onBlur} data-testid="example-label-input" />
                  <textarea value={newEx.user_msg} onChange={e => setNewEx(p => ({ ...p, user_msg: e.target.value }))}
                    placeholder="What the user asks..." style={{ ...T.textarea, minHeight: "55px", marginBottom: "8px", fontSize: "12px" }} onFocus={onFocus} onBlur={onBlur} data-testid="example-user-input" />
                  <textarea value={newEx.bot_msg} onChange={e => setNewEx(p => ({ ...p, bot_msg: e.target.value }))}
                    placeholder="The ideal bot response..." style={{ ...T.textarea, minHeight: "75px", marginBottom: "10px", fontSize: "12px" }} onFocus={onFocus} onBlur={onBlur} data-testid="example-bot-input" />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={addExample} data-testid="save-example-btn" style={{ ...T.btnPrimary, fontSize: "12px", padding: "7px 16px" }}>
                      <Plus size={11} /> Save Example
                    </button>
                    <button onClick={() => setShowAddForm(false)} style={{ ...T.btnGhost, fontSize: "12px" }}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "12px", padding: "11px 14px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.subtle}`, borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MessageSquare size={13} color={colors.text.secondary} />
                  <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary }}>
                    <span style={{ color: approvedCount > 0 ? colors.brand.success : colors.text.secondary, fontWeight: "500" }}>{approvedCount}</span> approved conversation{approvedCount !== 1 ? "s" : ""} also used for training
                  </span>
                </div>
                <a href="/admin/conversations" data-testid="link-to-conversations"
                  style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: colors.brand.cyan, fontFamily: fonts.body, textDecoration: "none" }}>
                  Manage <ExternalLink size={11} />
                </a>
              </div>

              <div style={{ marginTop: "8px", padding: "10px 14px", backgroundColor: "rgba(59,130,246,0.05)", border: `1px solid rgba(59,130,246,0.15)`, borderRadius: "10px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Lightbulb size={12} color={colors.brand.blue} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, margin: 0, lineHeight: "1.5" }}>
                    <strong style={{ color: colors.text.primary }}>Total: {totalToneExamples} tone examples active.</strong>{" "}
                    The more examples you add, the more consistently the bot speaks in your voice. Crafted examples take priority over approved conversations.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {showPreview && (
            <div style={T.card}>
              <p style={T.sectionTitle}>System Prompt Preview</p>
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.secondary, marginBottom: "14px", marginTop: "4px" }}>
                Exactly what Claude receives. Knowledge and tone examples are injected at runtime.
              </p>
              <pre style={{
                backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`, borderRadius: "10px",
                padding: "14px 16px", color: colors.text.secondary, fontFamily: fonts.mono,
                fontSize: "11px", lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-word",
                margin: 0, maxHeight: "420px", overflowY: "auto"
              }}>
                {systemPromptPreview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
