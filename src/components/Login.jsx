import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { buildApiUrl } from '../api-url';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [forgotStatus, setForgotStatus] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
      } catch (err) {
        setError('Network error or server unavailable');
        console.error('Login error:', err);
      }
    };
  
  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) {
      setForgotError('Please provide the email you used to register.');
      return;
    }
    setIsSendingReset(true);
    setForgotError('');
    setForgotStatus('');
    try {
      const response = await fetch(buildApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to request password help');
      }
      setForgotStatus(payload.message || 'If that email exists we sent instructions.');
      setForgotError('');
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-layout">
        <div className="login-hero">
          <p className="login-hero__eyebrow">Dev KPI Portal</p>
          <h1>Monitor every ERP signal in one place</h1>
          <p className="login-hero__subtitle">
            dev.nanaabaackah.com surfaces live metrics from all databases along with system health insights.
          </p>
          <ul className="login-hero__list">
            <li>
              <span>Live API data</span>
              <strong>Realtime</strong>
            </li>
            <li>
              <span>Secure access</span>
              <strong>JWT protected</strong>
            </li>
            <li>
              <span>System visibility</span>
              <strong>Status checks</strong>
            </li>
          </ul>
        </div>
        <div className="login-card">
          <div className="login-card__header">
            <h2 className="login-card__title">Sign in</h2>
            <p className="login-card__subtitle">Use the seeded admin credentials to unlock the KPI dashboard.</p>
          </div>
          {error && (
            <Alert variant="danger" className="login-alert">
              {error}
            </Alert>
          )}
          <Form onSubmit={handleSubmit} className="login-form">
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formBasicPassword">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  variant={showPassword ? 'secondary' : 'outline-secondary'}
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="toggle-password"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              </InputGroup>
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100 login-button">
              Sign in
            </Button>
          </Form>
          <div className="login-card__helper">
            <button
              type="button"
              className="login-card__link"
              onClick={() => {
                setForgotMode((prev) => !prev);
                setForgotStatus('');
                setForgotError('');
              }}
            >
              {forgotMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
          </div>
          {forgotMode && (
            <form className="login-card__forgot" onSubmit={handleForgotSubmit}>
              <p className="login-card__forgot-label">
                Enter the email you use for this dashboard and we’ll send recovery steps.
              </p>
              {forgotStatus && <p className="login-card__forgot-status">{forgotStatus}</p>}
              {forgotError && <Alert variant="warning">{forgotError}</Alert>}
              <Form.Group className="mb-3" controlId="forgotEmail">
                <Form.Label>Email address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </Form.Group>
              <Button
                variant="outline-light"
                type="submit"
                className="w-100 login-button"
                disabled={isSendingReset}
              >
                {isSendingReset ? 'Sending reset link…' : 'Send reset link'}
              </Button>
            </form>
          )}
          <div className="login-card__footer">
            Need help? Reach us at <a href="mailto:hello@nanaabaackah.com">hello@nanaabaackah.com</a>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
