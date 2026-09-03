import { useState } from 'react';
import { DecisionProLogo } from './DecisionProLogo.jsx';

export const DEMO_USER_ID = 'DemoUser';
export const DEMO_PASSWORD = 'Xeno123';

function PasswordVisibilityIcon({ visible }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M10.6 10.6a2.2 2.2 0 0 0 3.1 3.1M9.9 5.2A10.4 10.4 0 0 1 12 5c5.2 0 9.1 4.1 10.5 6.2a1.2 1.2 0 0 1 0 1.4c-.5.8-1.5 2-2.9 3.2M6.1 6.1C4.4 7.4 3.2 9 2.5 10.2a1.2 1.2 0 0 0 0 1.4C3.9 13.7 7.8 18 13 18c1.1 0 2.1-.2 3.1-.5"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function DemoLoginGate({ children, showAutoLogin = import.meta.env.DEV }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(DEMO_USER_ID);
  // Prefill credentials only in local development; online demo stays blank.
  const [password, setPassword] = useState(showAutoLogin ? DEMO_PASSWORD : '');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');

  function authenticate(event) {
    event.preventDefault();
    if (userId === DEMO_USER_ID && password === DEMO_PASSWORD) {
      setError('');
      setIsAuthenticated(true);
      return;
    }

    setError('The user ID or password is incorrect.');
  }

  if (isAuthenticated) return children;

  return (
    <main className="demo-login-shell">
      <section className="demo-login-card" aria-labelledby="demo-login-title">
        <DecisionProLogo className="demo-login-brand" />
        <div className="demo-login-heading">
          <p className="demo-login-eyebrow">Dashboard access</p>
          <h1 id="demo-login-title">Sign in to DecisionPro</h1>
          <p>Use the demonstration credentials to open the legislative modeling dashboard.</p>
        </div>

        <form className="demo-login-form" onSubmit={authenticate} noValidate>
          <label htmlFor="demo-user-id">User ID</label>
          <input
            id="demo-user-id"
            name="userId"
            type="text"
            autoComplete="username"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
              setError('');
            }}
            aria-invalid={Boolean(error)}
          />

          <label htmlFor="demo-password">Password</label>
          <div className="demo-login-password-field">
            <input
              id="demo-password"
              name="password"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'demo-login-error' : undefined}
            />
            <button
              className="demo-login-password-toggle"
              type="button"
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((current) => !current)}
            >
              <PasswordVisibilityIcon visible={passwordVisible} />
            </button>
          </div>

          {error ? <p className="demo-login-error" id="demo-login-error" role="alert">{error}</p> : null}

          <button className="demo-login-submit" type="submit">Login</button>
          {showAutoLogin ? (
            <button className="demo-login-auto" type="button" onClick={() => setIsAuthenticated(true)}>
              AutoLogin
            </button>
          ) : null}
        </form>

        <p className="demo-login-notice">Demonstration environment · Aggregate and de-identified information only</p>
      </section>
    </main>
  );
}
