import { useEffect, useRef, useState } from 'react';
import { buildAskSamStarterPrompts, buildSamReply } from '../lib/askSam.js';
import { fetchAskSamReply, fetchAskSamStatus } from '../lib/askSamClient.js';
import { parseMarkdownBlocks } from '../lib/askSamFormat.js';

function renderInline(text, keyPrefix = 'i') {
  const nodes = [];
  const re = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|_[^_\n]+_|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m;
  let idx = 0;
  const source = String(text || '');
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) {
      nodes.push(<span key={`${keyPrefix}-t${idx}`}>{source.slice(last, m.index)}</span>);
    }
    const token = m[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b${idx}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-e${idx}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('_') && token.endsWith('_')) {
      nodes.push(<em key={`${keyPrefix}-u${idx}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c${idx}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        nodes.push(
          <a key={`${keyPrefix}-a${idx}`} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(<span key={`${keyPrefix}-x${idx}`}>{token}</span>);
      }
    } else {
      nodes.push(<span key={`${keyPrefix}-x${idx}`}>{token}</span>);
    }
    last = m.index + token.length;
    idx += 1;
  }
  if (last < source.length) {
    nodes.push(<span key={`${keyPrefix}-end`}>{source.slice(last)}</span>);
  }
  return nodes.length ? nodes : source;
}

function MessageBody({ text }) {
  const blocks = parseMarkdownBlocks(text);
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'hr') {
          return <hr key={`hr-${i}`} className="ask-sam-md-hr" />;
        }
        if (block.type === 'heading') {
          return (
            <p key={`h-${i}`} className="ask-sam-md-heading">
              {renderInline(block.text, `h-${i}`)}
            </p>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={`ul-${i}`} className="ask-sam-md-list">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `li-${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'table') {
          const colCount = Math.max(
            block.header.length,
            ...block.rows.map((r) => r.length),
            1,
          );
          const pad = (row) => {
            const next = [...row];
            while (next.length < colCount) next.push('');
            return next.slice(0, colCount);
          };
          return (
            <div key={`tbl-${i}`} className="ask-sam-md-table-wrap">
              <table className="ask-sam-md-table">
                <thead>
                  <tr>
                    {pad(block.header).map((cell, c) => (
                      <th key={c}>{renderInline(cell, `th-${i}-${c}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r}>
                      {pad(row).map((cell, c) => (
                        <td key={c}>{renderInline(cell, `td-${i}-${r}-${c}`)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={`p-${i}`}>{renderInline(block.text, `p-${i}`)}</p>;
      })}
    </>
  );
}

function welcomeFor(status) {
  if (status?.live) {
    return [
      "Hi — I'm **Sam**, your DecisionPro assistant.",
      '',
      `Live mode is on (**${status.provider}** · ${status.model}). Ask questions, request analysis, propose examination options, or ask how to use the app.`,
      '',
      "I'll cite freshness, owners, and caveats from the active session and keep recommendations as options to examine.",
    ].join('\n');
  }
  return [
    "Hi — I'm **Sam**, your DecisionPro assistant.",
    '',
    'Ask questions, request an analysis of what you have blended, propose examination options, or ask how to use the app.',
    '',
    'Local assistant mode is active (no server API key). Add an API key in `.env` and restart for live LLM replies — see ASK_SAM.md.',
  ].join('\n');
}

export function AskSamDock({
  open,
  context,
  variant = 'dock',
  guidedPrompt = null,
  guidedReply = null,
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ live: false, provider: null, model: null });
  const [messages, setMessages] = useState([{ id: 'welcome', role: 'sam', text: welcomeFor(null) }]);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const statusLoaded = useRef(false);
  const nav = variant === 'nav';
  const guided = Boolean(guidedPrompt || guidedReply);

  useEffect(() => {
    let cancelled = false;
    fetchAskSamStatus().then((next) => {
      if (cancelled) return;
      setStatus(next);
      if (!statusLoaded.current) {
        statusLoaded.current = true;
        setMessages([{ id: 'welcome', role: 'sam', text: welcomeFor(next) }]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!guided) return;
    setInput(guidedPrompt || '');
    const next = [{ id: 'welcome', role: 'sam', text: welcomeFor(status) }];
    if (guidedPrompt) {
      next.push({ id: 'guided-user', role: 'user', text: guidedPrompt });
    }
    if (guidedReply) {
      next.push({ id: 'guided-sam', role: 'sam', text: guidedReply });
    }
    setMessages(next);
  }, [guided, guidedPrompt, guidedReply, status]);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (!guided) inputRef.current?.focus();
    }
  }, [open, messages, busy, guided]);

  async function send(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed || busy || guided) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      let reply;
      let note;

      try {
        const data = await fetchAskSamReply({
          message: trimmed,
          context,
          history,
        });
        reply = data.reply || buildSamReply(trimmed, context);
        note = data.note;
        if (data.provider && data.mode === 'live') {
          setStatus((prev) => ({
            ...prev,
            live: true,
            provider: data.provider,
            model: data.model || prev.model,
          }));
        }
      } catch {
        reply = buildSamReply(trimmed, context);
        note = 'API unreachable — using local Sam.';
        await new Promise((r) => setTimeout(r, 280));
      }

      const suffix = note ? `\n\n(${note})` : '';
      setMessages((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          role: 'sam',
          text: `${reply}${suffix}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const starters = buildAskSamStarterPrompts({
    roleId: context?.roleId || null,
    view: context?.view || null,
  });

  return (
    <section
      className={`ask-sam-dock ${nav ? 'ask-sam-nav-stream' : ''}`}
      aria-label="Ask Sam chat"
      data-walkthrough-target="ask-sam-panel"
    >
      <div className="ask-sam-starters" aria-label="Suggested questions from your dashboard">
        {starters.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="ask-sam-chip"
            onClick={() => send(prompt)}
            disabled={busy || guided}
            title={prompt}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className={`ask-sam-stream-wrap ${busy ? 'is-busy' : ''}`}>
        <div
          className="ask-sam-stream"
          role="log"
          aria-live="polite"
          data-walkthrough-target="ask-sam-stream"
        >
          {messages.map((msg) => (
            <article key={msg.id} className={`ask-sam-msg ${msg.role}`}>
              <span className="ask-sam-who">{msg.role === 'sam' ? 'Sam' : 'You'}</span>
              <div className="ask-sam-bubble">
                <MessageBody text={msg.text} />
              </div>
            </article>
          ))}
          <div ref={endRef} />
        </div>
        {busy ? (
          <div className="ask-sam-thinking-overlay" role="status" aria-live="polite" aria-busy="true">
            <div className="ask-sam-spinner" aria-hidden="true" />
            <p className="ask-sam-thinking-label">Thinking...</p>
          </div>
        ) : null}
      </div>

      <div className="ask-sam-composer-block">
        {busy ? (
          <div
            className="ask-sam-progress"
            role="progressbar"
            aria-valuetext="Sam is thinking"
            aria-busy="true"
          >
            <div className="ask-sam-progress-bar" aria-hidden="true" />
          </div>
        ) : null}
        <form
          className="ask-sam-composer"
          data-walkthrough-target="ask-sam-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label className="sr-only" htmlFor="ask-sam-input">
            Message Sam
          </label>
          <input
            id="ask-sam-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={nav ? 'Ask Sam…' : 'Ask a question, request analysis, propose options, or ask how to use DecisionPro…'}
            disabled={busy || guided}
            autoComplete="off"
            readOnly={guided}
          />
          <button type="submit" className="sap-btn primary" disabled={busy || guided || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
