// CodeXen: v1 not-applicable
// "My target" on simple-mode measure cards (plan item #7). Two modes:
// demo mode keeps draft targets in this browser only; signed in (Google or
// Apple), targets are saved to the viewer's DecisionPro account by the API,
// which owns every rule (ADR-001). This file is presentation and transport.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber, measureValue } from '../../lib/simpleMode/measureModel.js';
import { checkTargetInput, readDraftTargets, removeDraftTarget, storeDraftTarget } from '../../lib/simpleMode/draftTargets.js';
import { APPLE_SCRIPT, GOOGLE_SCRIPT, SIGN_IN_PROVIDERS, apiConfigured, loadScript, targetsApi } from '../../lib/simpleMode/targetsClient.js';

const TargetsContext = createContext(null);

export function useTargets() {
  return useContext(TargetsContext);
}

function targetsFromApi(data) {
  const map = {};
  for (const t of data?.targets || []) map[t.measureId] = { value: t.value, note: t.note || '', revision: t.revision };
  return map;
}

export function TargetsProvider({ children }) {
  const [mode, setMode] = useState('demo'); // 'demo' | 'signed-in'
  const [account, setAccount] = useState(null);
  const [drafts, setDrafts] = useState(() => readDraftTargets());
  const [saved, setSaved] = useState({});
  const [notice, setNotice] = useState('');

  const loadAccount = useCallback(async () => {
    if (!apiConfigured()) return;
    try {
      const me = await targetsApi.me();
      if (!me.ok) { setMode('demo'); setAccount(null); return; }
      setAccount(me.data);
      setMode('signed-in');
      const list = await targetsApi.listTargets();
      if (list.ok) setSaved(targetsFromApi(list.data));
    } catch {
      setNotice('The DecisionPro sign-in service could not be reached. Targets work in demo mode.');
      setMode('demo');
    }
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  const value = useMemo(() => {
    const signedIn = mode === 'signed-in';
    return {
      mode,
      account,
      notice,
      targetFor: (id) => (signedIn ? saved[id] : drafts[id]) || null,
      async signIn(provider, token) {
        const res = provider === 'google' ? await targetsApi.signInWithGoogle(token) : await targetsApi.signInWithApple(token);
        if (!res.ok) { setNotice(res.data?.message || 'Sign-in did not succeed.'); return; }
        setNotice('');
        await loadAccount();
      },
      async signOut() {
        await targetsApi.signOut();
        setAccount(null);
        setSaved({});
        setMode('demo');
      },
      async openEditor() {
        if (!signedIn) return { ok: true };
        const res = await targetsApi.openForEditing();
        return res.ok ? { ok: true } : { ok: false, message: res.data?.message || res.data?.holder || 'Your targets are open for editing elsewhere.' };
      },
      async cancelEditor() {
        if (signedIn) await targetsApi.cancelEditing();
      },
      async save(id, target) {
        if (!signedIn) { setDrafts((d) => storeDraftTarget(d, id, target)); return { ok: true }; }
        const res = await targetsApi.saveTargets([{ measureId: id, value: target.value, note: target.note || '', retire: false }]);
        if (!res.ok || res.data?.errors?.length) return { ok: false, message: res.data?.errors?.[0]?.message || res.data?.message || 'The target was not saved.' };
        const list = await targetsApi.listTargets();
        if (list.ok) setSaved(targetsFromApi(list.data));
        return { ok: true };
      },
      async remove(id) {
        if (!signedIn) { setDrafts((d) => removeDraftTarget(d, id)); return { ok: true }; }
        const res = await targetsApi.saveTargets([{ measureId: id, value: 0, note: '', retire: true }]);
        if (!res.ok) return { ok: false, message: res.data?.message || 'The target was not removed.' };
        const list = await targetsApi.listTargets();
        if (list.ok) setSaved(targetsFromApi(list.data));
        return { ok: true };
      },
    };
  }, [mode, account, notice, drafts, saved, loadAccount]);

  return <TargetsContext.Provider value={value}>{children}</TargetsContext.Provider>;
}

// ---- Account bar -------------------------------------------------------------

function GoogleButton({ onCredential }) {
  const ref = useRef(null);
  useEffect(() => {
    let live = true;
    loadScript(GOOGLE_SCRIPT).then(() => {
      if (!live || !window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: SIGN_IN_PROVIDERS.google, callback: (r) => onCredential(r.credential) });
      window.google.accounts.id.renderButton(ref.current, { theme: 'filled_black', size: 'medium', text: 'signin_with' });
    }).catch(() => {});
    return () => { live = false; };
  }, [onCredential]);
  return <span ref={ref} className="sm-signin-google" />;
}

function AppleButton({ onIdToken }) {
  const signIn = async () => {
    await loadScript(APPLE_SCRIPT);
    window.AppleID.auth.init({ clientId: SIGN_IN_PROVIDERS.apple, scope: 'email', redirectURI: `${window.location.origin}/`, usePopup: true });
    const res = await window.AppleID.auth.signIn();
    if (res?.authorization?.id_token) onIdToken(res.authorization.id_token);
  };
  return <button type="button" className="sm-chip" onClick={() => { signIn().catch(() => {}); }}>Sign in with Apple</button>;
}

export function TargetsAccountBar() {
  const t = useTargets();
  if (!t) return null;
  const configured = apiConfigured();
  return (
    <div className="sm-account-bar" aria-label="Your targets">
      {t.mode === 'signed-in' ? (
        <>
          <span>Targets are saved to your account{t.account?.email ? ` (${t.account.email})` : ''}.</span>
          <button type="button" className="sm-link" onClick={() => t.signOut()}>Sign out</button>
        </>
      ) : (
        <>
          <span><strong>Demo mode:</strong> targets you set are drafts kept in this browser only.</span>
          {configured ? (
            <span className="sm-signin">
              Sign in to save them to your account:
              {SIGN_IN_PROVIDERS.google ? <GoogleButton onCredential={(c) => t.signIn('google', c)} /> : null}
              {SIGN_IN_PROVIDERS.apple ? <AppleButton onIdToken={(c) => t.signIn('apple', c)} /> : null}
            </span>
          ) : null}
        </>
      )}
      {t.notice ? <span className="sm-account-notice" role="status">{t.notice}</span> : null}
    </div>
  );
}

// ---- My target line on a measure card -------------------------------------------

function gapText(measure, target) {
  const v = measureValue(measure);
  if (!Number.isFinite(v) || !Number.isFinite(target)) return '';
  const diff = v - target;
  if (diff === 0) return 'on target';
  const unit = measure.unit === 'percent' ? 'points' : measure.unit;
  const amount = `${formatNumber(Math.abs(diff), unit)}${measure.unit === 'percent' ? ' points' : ''}`;
  const side = diff > 0 ? 'above' : 'below';
  if (!measure.betterDirection) return `${amount} ${side} target`;
  const met = measure.betterDirection === 'higher' ? diff >= 0 : diff <= 0;
  return `${amount} ${side} target · ${met ? 'met' : 'not met'}`;
}

export function MyTargetLine({ measure }) {
  const t = useTargets();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  if (!t) return null;
  const target = t.targetFor(measure.id);
  const label = t.mode === 'signed-in' ? 'My target' : 'My target (draft)';

  const open = async () => {
    const res = await t.openEditor();
    if (!res.ok) { setMessage(res.message); return; }
    setText(target ? String(target.value) : '');
    setNote(target?.note || '');
    setMessage('');
    setEditing(true);
  };
  const close = async () => { await t.cancelEditor(); setEditing(false); };
  const save = async (e) => {
    e.preventDefault();
    const checked = checkTargetInput(text, measure.unit);
    if (!checked.ok) { setMessage(checked.reason); return; }
    const res = await t.save(measure.id, { value: checked.value, note });
    if (!res.ok) { setMessage(res.message); return; }
    setEditing(false);
  };
  const remove = async () => {
    const res = await t.remove(measure.id);
    if (!res.ok) { setMessage(res.message); return; }
    setEditing(false);
  };

  return (
    <div className="sm-my-target" data-my-target={measure.id}>
      <dt>{label}</dt>
      <dd>
        {editing ? (
          <form className="sm-target-form" onSubmit={save} onClick={(e) => e.stopPropagation()}>
            <label><span className="sr-only">Target value</span><input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-label={`Target for ${measure.label}`} /></label>
            <label><span className="sr-only">Why this target</span><input value={note} maxLength={500} placeholder="Why (optional)" onChange={(e) => setNote(e.target.value)} aria-label="Why this target" /></label>
            <span className="sm-target-actions">
              <button type="submit" className="sm-chip">Save</button>
              {target ? <button type="button" className="sm-link" onClick={remove}>Remove</button> : null}
              <button type="button" className="sm-link" onClick={close}>Cancel</button>
            </span>
          </form>
        ) : target ? (
          <>
            {formatNumber(target.value, measure.unit)} <small>{gapText(measure, target.value)}</small>{' '}
            <button type="button" className="sm-link" onClick={open}>Change</button>
          </>
        ) : (
          <button type="button" className="sm-link" onClick={open}>Set my target</button>
        )}
        {message ? <span className="sm-target-message" role="alert">{message}</span> : null}
      </dd>
    </div>
  );
}
