import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders markdown content with rich formatting.
 * Supports: bold, italic, code blocks, inline code, tables, lists, links, headings.
 * Props:
 *   content  — raw markdown string
 *   isUser   — true for user messages (minimal styling)
 *   compact  — true for widget mode (smaller sizing)
 */
export default function MarkdownMessage({ content, isUser, compact }) {
  if (!content) return null;

  // User messages: plain text, no markdown
  if (isUser) {
    return <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</span>;
  }

  const base = compact ? 12 : 14;
  const mono = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";

  return (
    <div className="bb-md" data-testid="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p style={{ margin: "0 0 8px", lineHeight: 1.7, fontSize: `${base}px`, wordBreak: "break-word" }}>{children}</p>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600, color: "inherit" }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ fontStyle: "italic", opacity: 0.9 }}>{children}</em>
          ),
          h1: ({ children }) => (
            <h3 style={{ fontSize: `${base + 4}px`, fontWeight: 700, margin: "12px 0 6px", letterSpacing: "-0.3px" }}>{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 style={{ fontSize: `${base + 2}px`, fontWeight: 600, margin: "10px 0 4px", letterSpacing: "-0.2px" }}>{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 style={{ fontSize: `${base + 1}px`, fontWeight: 600, margin: "8px 0 4px" }}>{children}</h5>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              style={{ color: "#60A5FA", textDecoration: "none", borderBottom: "1px solid rgba(96,165,250,0.3)" }}>
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: "4px 0 8px", paddingLeft: "20px", listStyleType: "disc" }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "4px 0 8px", paddingLeft: "20px" }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ margin: "2px 0", fontSize: `${base}px`, lineHeight: 1.6 }}>{children}</li>
          ),
          code: ({ inline, className, children }) => {
            if (inline) {
              return (
                <code style={{
                  fontFamily: mono, fontSize: `${base - 1.5}px`,
                  backgroundColor: "rgba(96,165,250,0.1)", color: "#93C5FD",
                  padding: "1px 5px", borderRadius: "4px", border: "1px solid rgba(96,165,250,0.15)",
                }}>
                  {children}
                </code>
              );
            }
            // Block code
            const lang = (className || "").replace("language-", "");
            return (
              <div style={{ margin: "8px 0", position: "relative" }}>
                {lang && (
                  <div style={{
                    position: "absolute", top: 0, right: 0,
                    padding: "2px 8px", fontSize: "9px", fontFamily: mono,
                    color: "rgba(148,163,184,0.6)", textTransform: "uppercase", letterSpacing: "0.05em",
                    borderRadius: "0 6px 0 4px", backgroundColor: "rgba(15,23,42,0.5)",
                  }}>
                    {lang}
                  </div>
                )}
                <pre style={{
                  fontFamily: mono, fontSize: `${base - 2}px`, lineHeight: 1.6,
                  backgroundColor: "rgba(15,23,42,0.6)", color: "#CBD5E1",
                  padding: "12px 14px", borderRadius: "8px",
                  border: "1px solid rgba(148,163,184,0.1)",
                  overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>
                  <code>{children}</code>
                </pre>
              </div>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote style={{
              margin: "8px 0", padding: "8px 14px",
              borderLeft: "3px solid rgba(96,165,250,0.4)",
              backgroundColor: "rgba(96,165,250,0.04)", borderRadius: "0 6px 6px 0",
              fontStyle: "italic", opacity: 0.9,
            }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: "auto", margin: "8px 0", borderRadius: "8px", border: "1px solid rgba(148,163,184,0.15)" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse",
                fontSize: `${base - 1}px`, fontFamily: "inherit",
              }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ backgroundColor: "rgba(30,41,59,0.8)" }}>{children}</thead>
          ),
          th: ({ children }) => (
            <th style={{
              padding: "8px 12px", textAlign: "left", fontWeight: 600,
              borderBottom: "1px solid rgba(148,163,184,0.2)", fontSize: `${base - 1}px`,
              color: "#E2E8F0", whiteSpace: "nowrap",
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{
              padding: "6px 12px",
              borderBottom: "1px solid rgba(148,163,184,0.08)", fontSize: `${base - 1}px`,
            }}>
              {children}
            </td>
          ),
          hr: () => (
            <hr style={{ border: "none", borderTop: "1px solid rgba(148,163,184,0.15)", margin: "12px 0" }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
