import React, { useState } from 'react';
import { Truck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';

const TEST_ACCOUNTS = [
  { name: 'kalp', email: 'kalp@transitops.com', role: 'Fleet Manager', color: 'var(--role-fleet)' },
  { name: 'kalpan', email: 'kalpan@transitops.com', role: 'Dispatcher', color: 'var(--role-dispatcher)' },
  { name: 'rajan', email: 'rajan@transitops.com', role: 'Driver', color: 'var(--role-driver)' },
  { name: 'aray', email: 'aray@transitops.com', role: 'Safety Officer', color: 'var(--role-safety)' },
  { name: 'dax', email: 'dax@transitops.com', role: 'Financial Analyst', color: 'var(--role-finance)' },
  { name: 'admin', email: 'admin@transitops.com', role: 'Admin', color: 'var(--role-admin)' },
];

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      localStorage.setItem('transitops_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (acc) => {
    setEmail(acc.email);
    setPassword('Password@123');
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
    }}>
      {/* Left: Login Form Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px',
        maxWidth: '480px',
        borderRight: '1px solid var(--border-color)',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              backgroundColor: 'var(--primary-color)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Truck size={24} color="#fff" />
            </div>
            <span style={{
              fontSize: '26px',
              fontWeight: '700',
              fontFamily: 'var(--font-title)',
              letterSpacing: '0.5px'
            }}>
              TransitOps
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Smart Transport Operations Platform
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: '2px',
              padding: '10px 14px',
              marginBottom: '20px',
              color: 'var(--error-text)',
              fontSize: '13px'
            }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Right: Info / Quick Login Panel */}
      <div style={{
        flex: 1,
        backgroundColor: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px',
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          fontFamily: 'var(--font-title)',
          marginBottom: '8px'
        }}>
          Test Accounts
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
          Click any role below to populate the login form. Password is <code style={{ color: 'var(--accent-color)' }}>Password@123</code> for all.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '36px' }}>
          {TEST_ACCOUNTS.map(acc => (
            <button
              key={acc.email}
              onClick={() => quickLogin(acc)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                background: 'none',
                border: '1px solid var(--border-color)',
                borderRadius: '2px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.2s',
                fontFamily: 'var(--font-family)',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = acc.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              <div style={{
                width: '36px', height: '36px',
                borderRadius: '2px',
                backgroundColor: acc.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: '700', fontSize: '14px',
                fontFamily: 'var(--font-title)',
                flexShrink: 0
              }}>
                {acc.name[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--text-main)' }}>
                  {acc.name} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>({acc.role})</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {acc.email}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{
          backgroundColor: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          borderRadius: '2px',
          padding: '14px 16px'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--accent-color)', fontWeight: '600', marginBottom: '6px' }}>
            TRANSPORT ERP MODULES
          </div>
          <ul style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.8, listStyle: 'none' }}>
            <li>• Dashboard KPIs & Fleet Monitoring</li>
            <li>• Vehicle Registry & Lifecycle</li>
            <li>• Driver Safety & License Tracking</li>
            <li>• Trip Dispatch with Smart Recommendations</li>
            <li>• Maintenance Scheduling & Workflow</li>
            <li>• Fuel & Expense Bookkeeping</li>
            <li>• Reports, Analytics & CSV Exports</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;
