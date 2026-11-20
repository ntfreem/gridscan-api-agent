/**
 * BotSettings — configure bot behaviour, AI provider/model, name, and logo.
 */
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  Settings, Save, Loader2, Upload, Trash2, Bot, Sparkles, Brain, MessageSquare,
} from "lucide-react";
import { colors, fonts, radius, T, onFocus, onBlur } from "../theme";
import { toast } from "sonner";

export default function BotSettingsPage() {
  const { botId } = useParams();
  const { api } = useSession();
  const [bot, setBot] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef(null);

  // Config fields
  const [persona, setPersona] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [credentialId, setCredentialId] = useState("");
  const [credentials, setCredentials] = useState([]);

  useEffect(() => {
    if (!botId) return;
    setLoading(true);
    Promise.all([
      api.bot(botId).catch(() => null),
      api.config("bot", botId).catch(() => null),
    ]).then(([botData, configData]) => {
      if (botData) {
        setBot(botData);
        setName(botData.name || "");
      }
      if (configData) {
        setConfig(configData);
        const c = configData.effective || configData.local || configData || {};
        setPersona(c.persona || c.system_prompt || "");
        setProvider(c.ai_provider || c.provider || "");
        setModel(c.ai_model || c.model || "");
        setTemperature(c.temperature ?? 0.7);
        setMaxTokens(c.max_tokens ?? 1024);
        setCredentialId(c.credential_id || c.ai_credential_id || "");
      }
    }).finally(() => setLoading(false));

    // Fetch available credentials for this bot's org
    api.bot(botId).then(b => {
      if (b?.organisation_id) {
        return api.credentials("organisation", b.organisation_id);
      }
    }).then(data => {
      if (data) setCredentials(data.credentials || data || []);
    }).catch(() => {});
  }, [botId, api]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save bot name
      if (name !== bot?.name) {
        await api.patchBot(botId, { name });
      }
      // Save config
      const changes = {};
      if (persona) changes.persona = persona;
      if (provider) changes.ai_provider = provider;
      if (model) changes.ai_model = model;
      if (temperature !== undefined) changes.temperature = temperature;
      if (maxTokens) changes.max_tokens = maxTokens;
      if (credentialId) changes.credential_id = credentialId;
      if (Object.keys(changes).length > 0) {
        await api.patchConfig("bot", botId, changes);
      }
      toast.success("Bot settings saved");
      // Refresh
      const updated = await api.bot(botId);
      if (updated) setBot(updated);
    } catch (err) { toast.error(err.detail || "Failed to save settings"); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB"); return; }
    setUploadingLogo(true);
    try {
      await api.putLogo(botId, file);
      toast.success("Logo uploaded");
      const updated = await api.bot(botId);
      if (updated) setBot(updated);
    } catch (err) { toast.error(err.detail || "Upload failed"); }
    finally { setUploadingLogo(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleDeleteLogo = async () => {
    try {
      await api.deleteLogo(botId);
      toast.success("Logo removed");
      const updated = await api.bot(botId);
      if (updated) setBot(updated);
    } catch (err) { toast.error(err.detail || "Failed to remove logo"); }
  };

  if (loading) {
    return (
      <div style={{ ...T.page, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "100px" }}>
        <Loader2 size={20} color={colors.brand.light} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!bot) {
    return <div style={T.page}><p style={{ color: colors.text.muted }}>Bot not found.</p></div>;
  }

  const aiCreds = credentials.filter(c => ["anthropic", "openai"].includes(c.provider) && c.state !== "revoked");

  return (
    <div style={T.page} data-testid="bot-settings-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <p style={T.overline}>Bot Configuration</p>
          <h1 style={{ ...T.h1, marginBottom: 0 }}>{bot.name} — Settings</h1>
        </div>
        <button onClick={handleSave} disabled={saving} data-testid="save-bot-settings"
          style={{ ...T.btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* General */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Bot size={16} color={colors.brand.light} />
            <p style={T.sectionTitle}>General</p>
          </div>
          <label style={T.label}>Bot Name</label>
          <input value={name} onChange={e => setName(e.target.value)} data-testid="bot-name-input"
            style={{ ...T.input, marginBottom: "14px" }} onFocus={onFocus} onBlur={onBlur} />
          <label style={T.label}>Logo</label>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label style={{ ...T.btnGhost, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
              <Upload size={12} /> {uploadingLogo ? "Uploading..." : "Upload Logo"}
              <input ref={fileRef} type="file" onChange={handleLogoUpload} style={{ display: "none" }} accept="image/*" />
            </label>
            {bot.has_logo && (
              <button onClick={handleDeleteLogo} style={{ ...T.btnGhost, color: colors.brand.error, borderColor: "rgba(244,63,94,0.3)" }}>
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
        </div>

        {/* AI Configuration */}
        <div style={T.card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Brain size={16} color="#A78BFA" />
            <p style={T.sectionTitle}>AI Configuration</p>
          </div>
          <label style={T.label}>AI Credential</label>
          <select value={credentialId} onChange={e => setCredentialId(e.target.value)} data-testid="bot-credential-select"
            style={{ ...T.input, marginBottom: "12px" }}>
            <option value="">Inherited from parent</option>
            {aiCreds.map(c => <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>)}
          </select>
          <label style={T.label}>Provider</label>
          <select value={provider} onChange={e => setProvider(e.target.value)} data-testid="bot-provider-select"
            style={{ ...T.input, marginBottom: "12px" }}>
            <option value="">Inherited</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
          <label style={T.label}>Model</label>
          <input value={model} onChange={e => setModel(e.target.value)} data-testid="bot-model-input"
            placeholder="e.g. claude-sonnet-4-20250514" style={{ ...T.input, marginBottom: "12px" }} onFocus={onFocus} onBlur={onBlur} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={T.label}>Temperature</label>
              <input value={temperature} onChange={e => setTemperature(Number(e.target.value))} type="number"
                min="0" max="2" step="0.1" data-testid="bot-temperature"
                style={T.input} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={T.label}>Max Tokens</label>
              <input value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))} type="number"
                min="1" max="128000" data-testid="bot-max-tokens"
                style={T.input} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>
        </div>
      </div>

      {/* Persona / System Prompt */}
      <div style={{ ...T.card, marginTop: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <MessageSquare size={16} color="#34D399" />
          <p style={T.sectionTitle}>Persona / System Prompt</p>
        </div>
        <p style={T.hint}>Define how the bot behaves and responds. This is sent as the system message to the AI.</p>
        <textarea value={persona} onChange={e => setPersona(e.target.value)} data-testid="bot-persona"
          rows={8} placeholder="You are a helpful assistant that..."
          style={{ ...T.textarea, marginTop: "8px" }} onFocus={onFocus} onBlur={onBlur} />
      </div>
    </div>
  );
}
