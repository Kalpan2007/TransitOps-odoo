import React from 'react';
import { Bell, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ROLE_DISPLAY = {
  FLEET_MANAGER: { label: 'Fleet Manager', color: 'var(--role-fleet)' },
  DISPATCHER: { label: 'Dispatcher', color: 'var(--role-dispatcher)' },
  DRIVER: { label: 'Driver', color: 'var(--role-driver)' },
  SAFETY_OFFICER: { label: 'Safety Officer', color: 'var(--role-safety)' },
  FINANCIAL_ANALYST: { label: 'Financial Analyst', color: 'var(--role-finance)' },
  ADMIN: { label: 'Admin', color: 'var(--role-admin)' },
};

const Header = ({ user, currentPage, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const roleInfo = user ? ROLE_DISPLAY[user.role] : null;

  return (
    <header style={{
      height: '56px',
      backgroundColor: 'var(--bg-header)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'fixed',
      top: 0,
      right: 0,
      left: 'var(--sidebar-width)',
      zIndex: 9,
      transition: 'background-color 0.25s ease, border-color 0.25s ease'
    }}>
      {/* Page Context */}
      <div>
        <h2 style={{
          fontSize: '15px',
          fontWeight: '600',
          color: 'var(--text-main)',
          fontFamily: 'var(--font-title)',
          textTransform: 'capitalize'
        }}>
          {currentPage}
        </h2>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            transition: 'all 0.2s'
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          title="Notifications"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
        >
          <Bell size={18} />
        </button>

        {/* User Profile Badge */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--border-radius)',
              backgroundColor: roleInfo?.color || 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px'
            }}>
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)' }}>
                {user.name}
              </div>
              <div style={{
                fontSize: '11px',
                color: roleInfo?.color || 'var(--text-muted)',
                fontWeight: '500'
              }}>
                {roleInfo?.label}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'var(--font-family)',
            transition: 'all 0.2s'
          }}
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
