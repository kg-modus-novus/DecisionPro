import { useState } from 'react';
import { DecisionProLogo } from './DecisionProLogo.jsx';

export const DEMO_USER_ID = 'DemoUser';
export const DEMO_PASSWORD = 'Dash123';

export function DemoLoginGate({ children, showAutoLogin = import.meta.env.DEV }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(DEMO_USER_ID);
  const [password, setPassword] = useState(DEMO_PASSWORD);
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
          <input
            id="demo-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError('');
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'demo-login-error' : undefined}
          />

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
