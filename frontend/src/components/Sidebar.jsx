import React from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  Navigation, 
  Wrench, 
  Fuel, 
  BarChart3, 
  ShieldAlert 
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, userRole }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['FLEET_MANAGER', 'DISPATCHER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'] },
    { id: 'vehicles', label: 'Vehicles', icon: Truck, roles: ['FLEET_MANAGER', 'DISPATCHER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'] },
    { id: 'drivers', label: 'Drivers', icon: Users, roles: ['FLEET_MANAGER', 'DISPATCHER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'] },
    { id: 'trips', label: 'Trips', icon: Navigation, roles: ['DISPATCHER', 'FLEET_MANAGER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST'] },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench, roles: ['FLEET_MANAGER', 'DISPATCHER', 'SAFETY_OFFICER'] },
    { id: 'expenses', label: 'Expenses', icon: Fuel, roles: ['FINANCIAL_ANALYST', 'FLEET_MANAGER'] },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, roles: ['FINANCIAL_ANALYST', 'FLEET_MANAGER'] },
    { id: 'users', label: 'Users & Roles', icon: ShieldAlert, roles: ['FLEET_MANAGER'] },
    { id: 'driverTrips', label: 'My Assigned Trips', icon: Navigation, roles: ['DRIVER'] }
  ];

  // Filter menu items by user role
  const visibleItems = menuItems.filter(item => 
    item.roles.includes(userRole) || (userRole === 'ADMIN' && item.id !== 'driverTrips')
  );

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 10
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          backgroundColor: 'var(--primary-color)',
          borderRadius: 'var(--border-radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#FFF',
          fontFamily: 'var(--font-title)',
          fontSize: '18px'
        }}>
          T
        </div>
        <div>
          <h1 style={{
            fontSize: '16px',
            fontWeight: '600',
            fontFamily: 'var(--font-title)',
            letterSpacing: '0.5px'
          }}>
            TransitOps
          </h1>
          <span style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight: '500'
          }}>
            Smart Transport ERP
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: 1,
        overflowY: 'auto'
      }}>
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                width: '100%',
                border: 'none',
                background: isActive ? 'var(--primary-bg-strong)' : 'transparent',
                color: isActive ? 'var(--accent-color)' : 'var(--text-main)',
                borderLeft: isActive ? '3px solid var(--accent-color)' : '3px solid transparent',
                borderRadius: '0 var(--border-radius) var(--border-radius) 0',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-family)',
                fontSize: '13px',
                fontWeight: isActive ? '500' : '400',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)' }} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <div>Version 1.0.0 (Odoo Skin)</div>
        <div>System Connected</div>
      </div>
    </aside>
  );
};

export default Sidebar;
