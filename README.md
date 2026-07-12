<p align="center">
  <img src="https://img.shields.io/badge/TransitOps-v1.0.0-714B67?style=for-the-badge&labelColor=0E0E10&color=714B67" alt="TransitOps"/>
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=white&labelColor=0E0E10" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white&labelColor=0E0E10" alt="Node.js"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white&labelColor=0E0E10" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white&labelColor=0E0E10" alt="Express"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge&labelColor=0E0E10" alt="License"/>
</p>

<p align="center">
  <strong>A centralized, production-grade ERP platform that digitizes vehicle, driver, dispatch, maintenance, and expense management for logistics operations.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> &bull;
  <a href="#-tech-stack">Tech Stack</a> &bull;
  <a href="#-local-development">Setup</a> &bull;
  <a href="#-api-reference">API</a> &bull;
  <a href="#-deployment">Deploy</a>
</p>

---

## Overview

Many logistics companies still rely on spreadsheets and manual logbooks, leading to scheduling conflicts, underutilized vehicles, missed maintenance, expired driver licenses, inaccurate expense tracking, and poor operational visibility.

**TransitOps** replaces all of that with a single source of truth — a full-lifecycle transport operations platform with role-based access control, atomic dispatch transactions, automatic status transitions, and real-time analytics.

---

## Features

### Authentication & RBAC
- Secure JWT-based login with email and password
- Four distinct roles with granular endpoint and UI gating:
  - **Fleet Manager** — Vehicle registry, maintenance, user management, full admin access
  - **Dispatcher** — Trip creation, dispatch, completion, cancellation with smart recommendations
  - **Safety Officer** — Driver profiles, license monitoring, safety scoring, suspension
  - **Financial Analyst** — Fuel logs, operational expenses, ROI analysis

### Dashboard
- KPI cards: Active Vehicles, Available Vehicles, Vehicles in Maintenance, Active Trips, Pending Trips, Drivers on Duty, Fleet Utilization %
- Fleet state distribution chart
- Active trips table with vehicle and driver details
- Open maintenance work orders
- Recent operational activity timeline
- Filters by vehicle type, status, and region

### Vehicle Registry
- Full CRUD with unique registration number enforcement
- Fields: Registration Number, Name/Model, Type, Max Load Capacity, Odometer, Acquisition Cost, Region, Status
- Status lifecycle: Available → On Trip / In Shop → Retired
- Detail panel with trip history, maintenance history, fuel logs, and expense records

### Driver Management
- Full CRUD with license number uniqueness
- License validity tracking: Valid, Expiring Soon (≤30 days), Expired
- Safety score tracking with visual indicator (0–100)
- Suspend / Unsuspend workflow
- Filters by status, category, validity, and search

### Trip Management
- 3-step dispatch wizard with smart resource recommendation engine
- Trip lifecycle: Draft → Dispatched → Completed / Cancelled
- Automatic vehicle and driver status transitions on dispatch, completion, and cancellation
- Cargo weight validation against vehicle capacity
- Final odometer and fuel consumption logging on completion

### Maintenance
- Work order creation auto-transitions vehicle status to In Shop
- Completion restores vehicle to Available (or stays Retired)
- Auto-books maintenance expense entry on completion
- 11 maintenance types: Engine Overhaul, Brake Service, Tyre Rotation, Oil Change, and more

### Fuel & Expense Management
- Fuel log recording with liters, cost, date, and odometer reading
- Operational expense tracking: Toll, Maintenance, Parking, Permit, Other
- Grand total calculation across fuel and operational costs
- Linked to vehicles and optionally to trips

### Reports & Analytics
- Four analytics tabs: Vehicle ROI, Fuel Efficiency, Operational Costs, Trip Counts
- 7 overview KPIs: Total Revenue, Operational Costs, Net Profit/Loss, Total Trips, Total Distance, Total Fuel Used, Avg Efficiency
- Date range filtering across all reports
- CSV export for all four report types

### Smart Dispatch Recommendation Engine
When dispatching, the system ranks available vehicles and drivers:
1. **Capacity Filter** — Eliminates vehicles where max capacity < cargo weight
2. **Capacity Fit Score** — Prioritizes vehicles whose capacity is closest to the cargo weight
3. **Fuel Efficiency Ranking** — Ranks by historical distance/fuel ratio
4. **Driver Alignment** — Pairs with the available driver with the highest safety score

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Lucide React, Vanilla CSS |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL (via `pg` driver) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Testing | Jest, Supertest |
| Linting | oxlint |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│        Vite dev server on :3000 → proxy /api         │
├─────────────────────────────────────────────────────┤
│                  REST API (Express)                  │
│   JWT Auth Middleware → RBAC Gate → Route Handler     │
│   Atomic Transactions (SELECT FOR UPDATE)            │
├─────────────────────────────────────────────────────┤
│               PostgreSQL Database                    │
│    7 tables · 12 indexes · Row-level locking         │
└─────────────────────────────────────────────────────┘
```

### Database Schema

| Table | Purpose |
|-------|---------|
| `users` | System users with roles and status |
| `vehicles` | Vehicle registry with status lifecycle |
| `drivers` | Driver profiles with license and safety data |
| `trips` | Trip records with dispatch lifecycle |
| `maintenance_logs` | Work orders linked to vehicles |
| `fuel_logs` | Fuel fill records linked to vehicles/trips |
| `expenses` | Operational expenses (tolls, parking, etc.) |

---

## Local Development

### Prerequisites
- Node.js v18+
- PostgreSQL instance

### 1. Clone and Install

```bash
git clone https://github.com/your-org/TransitOps-odoo.git
cd TransitOps-odoo

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/transitops
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```

### 3. Seed Database

```bash
cd backend
npm run seed
```

This creates all tables, enums, indexes, and seeds 4 users, 4 vehicles, and 4 drivers.

### 4. Start Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### Test Accounts

| Email | Password | Role |
|-------|----------|------|
| alice@transitops.com | Password@123 | Fleet Manager |
| bob@transitops.com | Password@123 | Dispatcher |
| charlie@transitops.com | Password@123 | Safety Officer |
| david@transitops.com | Password@123 | Financial Analyst |

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except login.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Authenticate and receive JWT |
| GET | `/api/auth/me` | Get current user profile |

### Vehicles
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/vehicles` | List vehicles (filters: type, status, region, search) | All |
| GET | `/api/vehicles/:id` | Vehicle detail with computed metrics | All |
| POST | `/api/vehicles` | Create vehicle | Fleet Manager |
| PUT | `/api/vehicles/:id` | Update vehicle | Fleet Manager |
| DELETE | `/api/vehicles/:id` | Delete vehicle | Fleet Manager |

### Drivers
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/drivers` | List drivers (filters: status, category, validity, search) | All |
| GET | `/api/drivers/:id` | Driver detail with trip history | All |
| POST | `/api/drivers` | Create driver | Safety Officer, Fleet Manager |
| PUT | `/api/drivers/:id` | Update driver | Safety Officer, Fleet Manager |
| PUT | `/api/drivers/:id/suspend` | Suspend driver | Safety Officer |
| PUT | `/api/drivers/:id/unsuspend` | Unsuspend driver | Safety Officer |
| PUT | `/api/drivers/:id/safety-score` | Update safety score | Safety Officer |
| DELETE | `/api/drivers/:id` | Delete driver | Safety Officer, Fleet Manager |

### Trips
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/trips` | List trips (filters: status, vehicle_id, driver_id) | All |
| GET | `/api/trips/:id` | Trip detail with vehicle/driver info | All |
| POST | `/api/trips` | Create draft trip | Dispatcher |
| POST | `/api/trips/:id/dispatch` | Dispatch trip (atomic) | Dispatcher |
| POST | `/api/trips/:id/complete` | Complete trip (atomic) | Dispatcher |
| POST | `/api/trips/:id/cancel` | Cancel trip (atomic) | Dispatcher |
| POST | `/api/trips/recommend-resources` | Smart dispatch recommendation | Dispatcher |

### Maintenance
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/maintenance` | List maintenance records | All |
| POST | `/api/maintenance` | Create work order (atomic) | Fleet Manager |
| POST | `/api/maintenance/:id/complete` | Complete work order (atomic) | Fleet Manager |

### Expenses
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/expenses/fuel` | List fuel logs | All |
| POST | `/api/expenses/fuel` | Create fuel log | Financial Analyst |
| GET | `/api/expenses/operational` | List operational expenses | All |
| POST | `/api/expenses/operational` | Create expense | Financial Analyst |

### Dashboard & Reports
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/dashboard` | KPIs and activity feed | All |
| GET | `/api/reports/analytics` | Analytics data (date range filter) | All |
| GET | `/api/reports/export-csv` | CSV export (4 report types) | All |

### Users
| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/users` | List all users | Fleet Manager |
| POST | `/api/users` | Create user | Fleet Manager |
| PUT | `/api/users/:id` | Update user | Fleet Manager |
| DELETE | `/api/users/:id` | Delete user | Fleet Manager |

---

## Business Rules

| Rule | Enforcement |
|------|------------|
| Vehicle registration number is unique | Database constraint + API validation |
| Retired or In Shop vehicles never appear in dispatch | Status check before dispatch |
| Expired license or Suspended driver cannot be assigned | 11-point validation before dispatch |
| On Trip vehicle/driver cannot be double-booked | `SELECT FOR UPDATE` row locking |
| Cargo weight must not exceed vehicle capacity | Hard check at dispatch time |
| Dispatching auto-sets vehicle + driver to On Trip | Atomic transaction |
| Completing a trip restores vehicle + driver to Available | Atomic transaction |
| Cancelling a dispatched trip restores resources | Atomic transaction |
| Creating maintenance auto-sets vehicle to In Shop | Atomic transaction |
| Closing maintenance restores vehicle to Available | Atomic transaction (unless Retired) |

---

## Project Structure

```
TransitOps-odoo/
├── backend/
│   ├── server.js                     # Entry point
│   ├── src/
│   │   ├── app.js                    # Express app setup
│   │   ├── config/
│   │   │   └── database.js           # PostgreSQL pool
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT + RBAC middleware
│   │   │   └── errorHandler.js       # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── vehicles.js
│   │   │   ├── drivers.js
│   │   │   ├── trips.js
│   │   │   ├── maintenance.js
│   │   │   ├── expenses.js
│   │   │   ├── reports.js
│   │   │   └── dashboard.js
│   │   └── utils/
│   │       └── seed.js               # Schema + seed data
│   └── tests/
│       └── integration.test.js       # E2E integration tests
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                   # Auth gate + tab routing
│       ├── api.js                    # API client (34 endpoints)
│       ├── index.css                 # Design system
│       ├── components/
│       │   ├── Sidebar.jsx           # Role-filtered navigation
│       │   └── Header.jsx            # Top bar + user badge
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Vehicles.jsx
│           ├── Drivers.jsx
│           ├── Trips.jsx
│           ├── Maintenance.jsx
│           ├── Expenses.jsx
│           ├── Reports.jsx
│           └── Users.jsx
└── README.md
```

---

## Testing

```bash
cd backend
npm test
```

The test suite covers:
- Authentication and RBAC enforcement
- Vehicle and driver CRUD with uniqueness constraints
- Trip lifecycle with all 11 dispatch validation rules
- Atomic transaction concurrency (double-booking prevention)
- Maintenance workflow with automatic status transitions
- Analytics and CSV export

---

## Deployment

### Database (Supabase)
1. Create a project at [supabase.com](https://supabase.com)
2. Copy the connection URI from **Settings → Database**
3. URL-encode special characters in the password (e.g. `@` → `%40`)

### Backend (Render)
1. Create a Web Service at [render.com](https://render.com)
2. Set root directory to `backend`
3. Build: `npm install` / Start: `node server.js`
4. Add env vars: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`

### Frontend (Vercel)
1. Import repository at [vercel.com](https://vercel.com)
2. Set root directory to `frontend`, framework preset to **Vite**
3. Add env var: `VITE_API_URL` → `https://your-backend.onrender.com/api`

---

## License

MIT
