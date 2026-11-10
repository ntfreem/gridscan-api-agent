import { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Save, Eye, EyeOff, Plus, X, ExternalLink, MessageSquare, Lightbulb, Cpu, Zap, DollarSign, Key, Copy, Trash2, Shield, ShieldOff, ToggleLeft, ToggleRight } from "lucide-react";
import { colors, fonts, T, onFocus, onBlur } from "../theme";

export default function BotSettings() {
  const { selectedInstance } = useAuth();
  const instanceId = selectedInstance?.id;
  const [config, setConfig] = useState({ name: "", persona: "", custom_instructions: "", tone_instructions: "", manual_tone_examples: [], knowledge_gate: "strict", knowledge_gate_pct: 0 });
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
    openai_api_key: "",
    ollama_base_url: "",
    anthropic_api_key_set: false,
    anthropic_api_key_preview: "",
    openai_api_key_set: false,
    openai_api_key_preview: "",
    allowed_anthropic_models: ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"],
    allowed_openai_models: ["gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-5", "gpt-5-mini"],
    default_models: { emergent: "claude-sonnet-4-6", anthropic: "claude-sonnet-4-6", openai: "gpt-4o", ollama: "llama3.1" },
  });
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState(null);
  const [costData, setCostData] = useState(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyRevealed, setNewKeyRevealed] = useState(null);

  useEffect(() => {
    if (!instanceId) return;
    api.get(`/admin/instances/${instanceId}/llm-config`).then(r => {
      if (r.data) setLlm(p => ({ ...p, ...r.data, anthropic_api_key: "", openai_api_key: "" }));
    }).catch(() => {});
    api.get(`/analytics/llm-cost`).then(r => setCostData(r.data)).catch(() => {});
    api.get(`/admin/api-keys`).then(r => setApiKeys(r.data || [])).catch(() => {});
  }, [instanceId]);

  const saveLlm = async () => {
    const payload = {
      provider: llm.provider,
      model: llm.model || null,
      // Send key only if the admin typed a new one; backend preserves existing on empty
      anthropic_api_key: llm.anthropic_api_key.trim() || null,
      openai_api_key: llm.openai_api_key.trim() || null,
      ollama_base_url: llm.ollama_base_url || null,
    };
    setLlmSaving(true); setLlmTestResult(null);
    try {
      await api.put(`/admin/instances/${instanceId}/llm-config`, payload);
      toast.success(`Provider saved: ${llm.provider}`);
      // Reload to refresh masked key preview
      const r = await api.get(`/admin/instances/${instanceId}/llm-config`);
      if (r.data) setLlm(p => ({ ...p, ...r.data, anthropic_api_key: "", openai_api_key: "" }));
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

  const createApiKey = async () => {
    setCreatingKey(true);
    try {
      const r = await api.post(`/admin/api-keys`, { instance_id: instanceId, label: newKeyLabel.trim() });
      setNewKeyRevealed(r.data.key);
      setNewKeyLabel("");
      api.get(`/admin/api-keys`).then(r2 => setApiKeys(r2.data || [])).catch(() => {});
      toast.success("API key created");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed to create key"); }
    finally { setCreatingKey(false); }
  };

  const revokeApiKey = async (keyId) => {
    try {
      await api.delete(`/admin/api-keys/${keyId}`);
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success("API key revoked");
    } catch { toast.error("Failed to revoke key"); }
  };

  const toggleApiKey = async (keyId) => {
    try {
      const r = await api.patch(`/admin/api-keys/${keyId}/toggle`);
      setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, is_active: r.data.is_active } : k));
    } catch { toast.error("Failed to toggle key"); }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key).then(() => toast.success("Copied to clipboard"));
  };

  useEffect(() => {
    api.get(`/admin/bot-config`).then(r => {
      if (r.data) setConfig({ name: r.data.name || "", persona: r.data.persona || "", custom_instructions: r.data.custom_instructions || "", tone_instructions: r.data.tone_instructions || "", manual_tone_examples: r.data.manual_tone_examples || [], knowledge_gate: r.data.knowledge_gate || "strict", knowledge_gate_pct: r.data.knowledge_gate_pct ?? (r.data.knowledge_gate === "flexible" ? 100 : 0) });
    }).catch(() => {});
    api.get(`/analytics/overview`).then(r => setApprovedCount(r.data?.approved_for_training ?? 0)).catch(() => {});
  }, [instanceId]);

  const save = async () => {
    if (!config.name.trim()) { toast.error("Bot name is required"); return; }
    if (!config.persona.trim()) { toast.error("Persona description is required"); return; }
    setSaving(true);
    try {
      const payload = { ...config };
      // Don't send empty api_key_value (preserve existing key on server)
      if (!payload.api_key_value) delete payload.api_key_value;
      await api.put(`/admin/bot-config`, payload);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); }
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

      {!instanceId ? (
        <div data-testid="no-instance-empty-state" style={{ ...T.card, marginTop: "20px", textAlign: "center", padding: "40px 24px" }}>
          <Cpu size={28} color={colors.text.muted} style={{ margin: "0 auto 12px" }} />
          <p style={{ ...T.sectionTitle, margin: "0 0 6px" }}>Select a workspace first</p>
          <p style={{ fontFamily: fonts.body, fontSize: "13px", color: colors.text.secondary, margin: 0, maxWidth: "440px", marginLeft: "auto", marginRight: "auto" }}>
            Use the workspace switcher in the sidebar to pick the bot instance you want to configure. Each instance has its own identity, knowledge base, and LLM provider.
          </p>
        </div>
      ) : (
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
            <p style={T.sectionSub}>Pick where this instance&apos;s AI calls go. <strong>Emergent</strong> uses the platform&apos;s Universal Key (default). <strong>Anthropic Direct</strong> / <strong>OpenAI Direct</strong> bill against your own accounts. <strong>Ollama</strong> calls a self-hosted model.</p>

            <label style={T.label}>Provider</label>
            <select
              value={llm.provider}
              onChange={e => setLlm(p => ({ ...p, provider: e.target.value, model: "" }))}
              data-testid="llm-provider-select"
              style={{ ...T.input, cursor: "pointer" }}
            >
              <option value="emergent">Emergent Universal Key (default)</option>
              <option value="anthropic">Anthropic Direct (BYO key)</option>
              <option value="openai">OpenAI Direct (BYO key)</option>
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
            ) : llm.provider === "openai" ? (
              <select
                value={llm.model || ""}
                onChange={e => setLlm(p => ({ ...p, model: e.target.value }))}
                data-testid="llm-model-select"
                style={{ ...T.input, cursor: "pointer" }}
              >
                <option value="">{`Default (${llm.default_models?.openai})`}</option>
                {(llm.allowed_openai_models || []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                value={llm.model || ""}
                onChange={e => setLlm(p => ({ ...p, model: e.target.value }))}
                placeholder={llm.provider === "ollama" ? "e.g. llama3.1, mistral" : `Default: ${llm.default_models?.emergent}`}
                data-testid="llm-model-input"
                autoComplete="off"
                name="dc-llm-model-name"
                onFocus={onFocus} onBlur={onBlur}
                style={T.input}
              />
            )}
            <p style={T.hint}>
              {llm.provider === "anthropic" && "Allowed: Haiku 4.5 (cheapest), Sonnet 4.5 (balanced), Opus 4.5 (best quality)."}
              {llm.provider === "openai" && "Choose from available OpenAI models. GPT-4o is a great starting point."}
              {llm.provider === "emergent" && "Model name only — Emergent supplies the key automatically. Leave blank to use Opus → Sonnet fallback."}
              {llm.provider === "ollama" && "Any model installed on your Ollama server."}
            </p>
            {/^(sk-|bbk_)/i.test(llm.model || "") && (
              <p data-testid="llm-model-key-warning" style={{ margin: "6px 0 0", padding: "6px 10px", fontSize: "11px", color: colors.brand.error, backgroundColor: "rgba(244,63,94,0.08)", border: `1px solid rgba(244,63,94,0.3)`, borderRadius: "6px", fontFamily: fonts.body }}>
                That looks like an API key, not a model name. Clear this field — Emergent does not need a key here.
              </p>
            )}

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

            {llm.provider === "openai" && (
              <>
                <label style={{ ...T.label, marginTop: "14px" }}>OpenAI API Key</label>
                <input
                  type="password"
                  value={llm.openai_api_key}
                  onChange={e => setLlm(p => ({ ...p, openai_api_key: e.target.value }))}
                  placeholder={llm.openai_api_key_set ? `Current: ${llm.openai_api_key_preview} — leave blank to keep` : "sk-…"}
                  autoComplete="new-password"
                  data-testid="llm-openai-key-input"
                  onFocus={onFocus} onBlur={onBlur}
                  style={T.input}
                />
                <p style={T.hint}>
                  Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: colors.brand.light }}>platform.openai.com</a>. Leave blank to keep the existing saved key.
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

          {/* ── Knowledge Gate — Percentage Slider ── */}
          <div data-testid="knowledge-gate-card" style={{ ...T.card, marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Shield size={14} color={
                config.knowledge_gate_pct <= 20 ? colors.brand.error
                : config.knowledge_gate_pct <= 60 ? colors.brand.warning
                : colors.brand.success
              } />
              <p style={{ ...T.sectionTitle, margin: 0 }}>Knowledge Gate</p>
            </div>
            <p style={T.sectionSub}>Controls how much the bot can use general AI knowledge beyond the knowledge base. Drag the slider or pick a preset.</p>

            {/* Quick Presets */}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              {[
                { label: "Conservative", pct: 10, color: colors.brand.error, desc: "KB only" },
                { label: "Balanced", pct: 50, color: colors.brand.warning, desc: "KB + labeled general" },
                { label: "Open", pct: 85, color: colors.brand.success, desc: "Free to answer" },
              ].map(preset => (
                <button
                  key={preset.label}
                  data-testid={`gate-preset-${preset.label.toLowerCase()}`}
                  onClick={() => setConfig(p => ({ ...p, knowledge_gate_pct: preset.pct, knowledge_gate: preset.pct <= 20 ? "strict" : "flexible" }))}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: "10px", cursor: "pointer",
                    backgroundColor: config.knowledge_gate_pct === preset.pct ? `${preset.color}12` : colors.bg.base,
                    border: `1.5px solid ${config.knowledge_gate_pct === preset.pct ? preset.color : colors.border.default}`,
                    textAlign: "center", transition: "all 0.2s ease",
                  }}
                >
                  <span style={{ display: "block", fontFamily: fonts.heading, fontSize: "12px", fontWeight: "600", color: config.knowledge_gate_pct === preset.pct ? preset.color : colors.text.secondary }}>{preset.label}</span>
                  <span style={{ display: "block", fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, marginTop: "2px" }}>{preset.desc}</span>
                </button>
              ))}
            </div>

            {/* Gate Level Label */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "14px", marginBottom: "8px" }}>
              <span style={{
                fontFamily: fonts.heading, fontSize: "14px", fontWeight: "700",
                color: config.knowledge_gate_pct <= 20 ? colors.brand.error
                     : config.knowledge_gate_pct <= 40 ? "#f59e0b"
                     : config.knowledge_gate_pct <= 60 ? colors.brand.warning
                     : config.knowledge_gate_pct <= 80 ? colors.brand.cyan
                     : colors.brand.success,
              }}>
                {config.knowledge_gate_pct <= 20 ? "Strict"
                 : config.knowledge_gate_pct <= 40 ? "Mostly Strict"
                 : config.knowledge_gate_pct <= 60 ? "Balanced"
                 : config.knowledge_gate_pct <= 80 ? "Mostly Open"
                 : "Fully Open"}
              </span>
              <span style={{ fontFamily: fonts.mono, fontSize: "13px", fontWeight: "600", color: colors.text.primary }}>
                {config.knowledge_gate_pct}%
              </span>
            </div>

            {/* Slider Track */}
            <div style={{ position: "relative", height: "36px", display: "flex", alignItems: "center" }}>
              <input
                data-testid="knowledge-gate-slider"
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.knowledge_gate_pct}
                onChange={e => {
                  const pct = parseInt(e.target.value);
                  setConfig(p => ({ ...p, knowledge_gate_pct: pct, knowledge_gate: pct <= 20 ? "strict" : "flexible" }));
                }}
                style={{
                  width: "100%", height: "6px", borderRadius: "3px",
                  appearance: "none", WebkitAppearance: "none",
                  background: `linear-gradient(to right, ${colors.brand.error} 0%, #f59e0b 25%, ${colors.brand.warning} 50%, ${colors.brand.cyan} 75%, ${colors.brand.success} 100%)`,
                  outline: "none", cursor: "pointer",
                }}
              />
            </div>

            {/* Scale Labels */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
              <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>KB Only</span>
              <span style={{ fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fully Open</span>
            </div>

            {/* Description */}
            <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.text.secondary, lineHeight: "1.5", marginTop: "10px", padding: "8px 10px", backgroundColor: colors.bg.base, borderRadius: "8px", border: `1px solid ${colors.border.faint}` }}>
              {config.knowledge_gate_pct <= 20
                ? "The bot only answers from the knowledge base. Questions not covered are politely declined."
                : config.knowledge_gate_pct <= 40
                ? "The bot answers from the knowledge base only but acknowledges topics it doesn't have info on."
                : config.knowledge_gate_pct <= 60
                ? "The bot prefers the knowledge base but can use general knowledge with a clear disclaimer."
                : config.knowledge_gate_pct <= 80
                ? "The bot freely supplements with general knowledge. KB is preferred but not required."
                : "The bot uses the full range of its knowledge. KB content is treated as a trusted reference."}
            </p>
            <p style={{ ...T.hint, marginTop: "8px" }}>Click &ldquo;Save Settings&rdquo; in the left panel to apply.</p>
          </div>

          {/* ── External API Keys ── */}
          <div data-testid="api-keys-card" style={{ ...T.card, marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Key size={14} color={colors.brand.cyan} />
              <p style={{ ...T.sectionTitle, margin: 0 }}>External API Keys</p>
            </div>
            <p style={T.sectionSub}>
              Generate <code style={{ fontFamily: fonts.mono, fontSize: "11px", backgroundColor: "rgba(96,165,250,0.1)", padding: "1px 5px", borderRadius: "4px" }}>bbk_...</code> API keys for external integrations. Use with <code style={{ fontFamily: fonts.mono, fontSize: "11px", backgroundColor: "rgba(96,165,250,0.1)", padding: "1px 5px", borderRadius: "4px" }}>POST /api/v1/chat</code>.
            </p>

            {/* New key revealed banner */}
            {newKeyRevealed && (
              <div data-testid="new-key-banner" style={{ margin: "12px 0", padding: "12px 14px", backgroundColor: "rgba(34,197,94,0.06)", border: `1px solid rgba(34,197,94,0.25)`, borderRadius: "10px" }}>
                <p style={{ margin: "0 0 6px", fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: "#22c55e" }}>New API key created — copy it now, it won&apos;t be shown again</p>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <code data-testid="new-key-value" style={{ fontFamily: fonts.mono, fontSize: "12px", color: colors.text.primary, backgroundColor: colors.bg.base, padding: "6px 10px", borderRadius: "6px", border: `1px solid ${colors.border.default}`, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{newKeyRevealed}</code>
                  <button onClick={() => copyKey(newKeyRevealed)} style={{ ...T.btnSecondary, padding: "6px 12px" }}><Copy size={13} /> Copy</button>
                  <button onClick={() => setNewKeyRevealed(null)} style={{ ...T.btnGhost, padding: "6px 10px" }}><X size={13} /></button>
                </div>
              </div>
            )}

            {/* Create new key */}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" }}>
              <input
                value={newKeyLabel}
                onChange={e => setNewKeyLabel(e.target.value)}
                placeholder="Key label (e.g. Website Widget)"
                data-testid="api-key-label-input"
                onFocus={onFocus} onBlur={onBlur}
                style={{ ...T.input, flex: 1, padding: "8px 12px" }}
              />
              <button onClick={createApiKey} disabled={creatingKey} data-testid="create-api-key-btn"
                style={{ ...T.btnPrimary, padding: "8px 16px", whiteSpace: "nowrap", opacity: creatingKey ? 0.6 : 1 }}>
                <Key size={13} /> {creatingKey ? "Creating..." : "Generate Key"}
              </button>
            </div>

            {/* Existing keys */}
            {apiKeys.length > 0 && (
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {apiKeys.map(k => (
                  <div key={k.id} data-testid="api-key-row" style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px",
                    backgroundColor: colors.bg.base, borderRadius: "8px", border: `1px solid ${colors.border.subtle}`,
                  }}>
                    <code style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary }}>{k.key_prefix}...</code>
                    {k.label && <span style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.primary, fontWeight: 500 }}>{k.label}</span>}
                    <span style={{ marginLeft: "auto", fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                      {k.usage_count || 0} calls
                    </span>
                    <button onClick={() => toggleApiKey(k.id)} data-testid="toggle-api-key-btn"
                      style={{ background: "none", border: "none", cursor: "pointer", color: k.is_active ? colors.brand.success : colors.text.muted, padding: 0 }}>
                      {k.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => revokeApiKey(k.id)} data-testid="revoke-api-key-btn"
                      style={{ background: "none", border: "none", cursor: "pointer", color: colors.text.secondary, padding: "2px", transition: "color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.color = colors.brand.error}
                      onMouseLeave={e => e.currentTarget.style.color = colors.text.secondary}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Usage example */}
            <div style={{ marginTop: "14px", padding: "12px", backgroundColor: colors.bg.base, borderRadius: "8px", border: `1px solid ${colors.border.subtle}` }}>
              <p style={{ margin: "0 0 6px", fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Usage Example</p>
              <code style={{ fontFamily: fonts.mono, fontSize: "11px", color: colors.text.secondary, lineHeight: "1.6", whiteSpace: "pre-wrap", display: "block" }}>
{`# Standard request
curl -X POST ${window.location.origin}/api/v1/chat \\
  -H "Authorization: Bearer bbk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello", "session_id": "optional-id"}'

# Streaming (SSE) — tokens arrive in real time
curl -N -X POST ${window.location.origin}/api/v1/chat/stream \\
  -H "Authorization: Bearer bbk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello", "session_id": "optional-id"}'`}
              </code>
            </div>
          </div>

          {/* ── Cost Dashboard — per-instance month-to-date spend + sparkline ── */}
          {costData && (
            <div data-testid="cost-dashboard-card" style={{ ...T.card, marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <DollarSign size={14} color="#22c55e" />
                <p style={{ ...T.sectionTitle, margin: 0 }}>Cost Dashboard</p>
                <span style={{ marginLeft: "auto", fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted, fontWeight: "400" }}>
                  Month-to-date · day {costData.month_to_date?.day_of_month}/{costData.month_to_date?.days_in_month}
                </span>
              </div>
              <p style={T.sectionSub}>Estimated LLM spend for this instance. Anthropic uses published list pricing; Ollama is free.</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                <div style={{ padding: "10px 12px", backgroundColor: "rgba(34,197,94,0.06)", border: `1px solid rgba(34,197,94,0.2)`, borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>MTD Cost</p>
                  <p data-testid="cost-mtd" style={{ margin: "2px 0 0", fontFamily: fonts.mono, fontSize: "18px", fontWeight: "700", color: "#22c55e" }}>
                    ${(costData.month_to_date?.cost_usd || 0).toFixed(2)}
                  </p>
                </div>
                <div style={{ padding: "10px 12px", backgroundColor: "rgba(251,191,36,0.06)", border: `1px solid rgba(251,191,36,0.2)`, borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Forecast</p>
                  <p data-testid="cost-forecast" style={{ margin: "2px 0 0", fontFamily: fonts.mono, fontSize: "18px", fontWeight: "700", color: colors.brand.warning }}>
                    ${(costData.forecast_month_end_usd || 0).toFixed(2)}
                  </p>
                  <p style={{ margin: "1px 0 0", fontFamily: fonts.body, fontSize: "9px", color: colors.text.muted }}>by month-end</p>
                </div>
                <div style={{ padding: "10px 12px", backgroundColor: "rgba(96,165,250,0.06)", border: `1px solid rgba(96,165,250,0.2)`, borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Calls / Tokens</p>
                  <p data-testid="cost-calls" style={{ margin: "2px 0 0", fontFamily: fonts.mono, fontSize: "14px", fontWeight: "700", color: colors.brand.light }}>
                    {(costData.month_to_date?.calls || 0).toLocaleString()}
                  </p>
                  <p style={{ margin: "1px 0 0", fontFamily: fonts.body, fontSize: "9px", color: colors.text.muted }}>
                    {Math.round(((costData.month_to_date?.input_tokens || 0) + (costData.month_to_date?.output_tokens || 0)) / 1000)}k tokens
                  </p>
                </div>
              </div>

              {/* Sparkline — last 30 days */}
              {costData.daily && costData.daily.length > 0 && (() => {
                const max = Math.max(...costData.daily.map(d => d.cost_usd || 0), 0.0001);
                const W = 360, H = 60, gap = 1;
                const barW = (W - (costData.daily.length - 1) * gap) / costData.daily.length;
                return (
                  <div data-testid="cost-sparkline" style={{ padding: "8px 0 4px" }}>
                    <p style={{ margin: "0 0 6px", fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Last 30 days · ${(costData.last_30d_cost_usd || 0).toFixed(2)} total
                    </p>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: `${H}px`, display: "block" }} preserveAspectRatio="none">
                      {costData.daily.map((d, i) => {
                        const cost = d.cost_usd || 0;
                        const h = max > 0 ? (cost / max) * (H - 8) : 0;
                        return (
                          <rect
                            key={i}
                            x={i * (barW + gap)}
                            y={H - h}
                            width={barW}
                            height={Math.max(h, 1)}
                            fill={cost > 0 ? "#22c55e" : "rgba(148,163,184,0.2)"}
                            opacity={cost > 0 ? 0.85 : 0.5}
                          >
                            <title>{`${d.date}: $${cost.toFixed(4)}`}</title>
                          </rect>
                        );
                      })}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted }}>
                      <span>{costData.daily[0]?.date}</span>
                      <span>{costData.daily[costData.daily.length - 1]?.date}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Per-model breakdown table */}
              {costData.by_model && costData.by_model.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <p style={{ margin: "0 0 6px", fontFamily: fonts.mono, fontSize: "9px", color: colors.text.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>By Model</p>
                  <div data-testid="cost-by-model" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {costData.by_model.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", backgroundColor: colors.bg.base, border: `1px solid ${colors.border.default}`, borderRadius: "6px" }}>
                        <span style={{ fontFamily: fonts.mono, fontSize: "9px", padding: "1px 6px", borderRadius: "4px", backgroundColor: "rgba(96,165,250,0.12)", color: colors.brand.light, fontWeight: "600", textTransform: "uppercase" }}>
                          {m.provider}
                        </span>
                        <span style={{ flex: 1, fontFamily: fonts.mono, fontSize: "11px", color: colors.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.model.replace(/^(anthropic|ollama|emergent):/, "")}
                        </span>
                        <span style={{ fontFamily: fonts.mono, fontSize: "10px", color: colors.text.muted }}>
                          {m.calls.toLocaleString()} calls
                        </span>
                        <span style={{ fontFamily: fonts.mono, fontSize: "11px", color: "#22c55e", fontWeight: "700", minWidth: "60px", textAlign: "right" }}>
                          ${m.cost_usd.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {costData.month_to_date?.calls === 0 && (
                <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.text.muted, fontStyle: "italic", margin: "8px 0 0" }}>
                  No LLM calls yet this month. Costs will appear here once the bot starts replying.
                </p>
              )}
            </div>
          )}

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
                Write ideal user/bot exchanges to show Claude exactly what &ldquo;good&rdquo; looks like.
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
      )}
    </div>
  );
}
