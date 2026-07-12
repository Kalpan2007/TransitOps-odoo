# TransitOps: Smart Transport Operations Platform (ERP)

TransitOps is a centralized, production-grade enterprise transport operations resource planning (ERP) platform designed for logistics organizations. It replaces spreadsheet-based and manual fleet management workflows with structured transactional pipelines, role-based access gates, strong backend data validations, and real-time operational dashboard analytics.

---

## 📖 Table of Contents
1. [Core Features](#-core-features)
2. [Tech Stack](#-tech-stack)
3. [Local Development Setup](#-local-development-setup)
4. [Database Schema & Architecture](#-database-schema--architecture)
5. [Smart Dispatch Recommendation Engine](#-smart-dispatch-recommendation-engine)
6. [Cloud Deployment Guide (Production)](#-cloud-deployment-guide-production)
7. [Repository File Structure](#-repository-file-structure)

---

## 🌟 Core Features

*   **Role-Based Access Control (RBAC):** Restricts endpoints and hides UI controls depending on JWT authenticated user roles:
    *   *Fleet Manager:* Full vehicle registry lifecycle & maintenance scheduler access.
    *   *Dispatcher:* Wizard-based trip creation, resource assignments, dispatching, and completion.
    *   *Safety Officer:* Driver profile registry, license expiry monitoring, safety scoring, and driver suspension.
    *   *Financial Analyst:* Fuel log bookkeeping, operational expenses tracking, and ROI analysis.
*   **Real-time Operations Dashboard:** Displays dynamic fleet statistics (Active/Available vehicles, shop items, active trips) and a live operational activity log.
*   **Transactional Trip Dispatch:** Uses PostgreSQL row-locking (`SELECT FOR UPDATE`) and database transactions (`BEGIN/COMMIT/ROLLBACK`) to enforce atomic dispatching and prevent race conditions or double-bookings of drivers and vehicles.
*   **Maintenance Scheduler:** Tracks vehicle maintenance lifecycles, automatically transitioning vehicle statuses to `IN_SHOP` to exclude them from the dispatch pool.
*   **Analytics & Exporter:** Compiles KPIs like Fuel Efficiency, Fleet Utilization, and Vehicle ROI, with full support for date-based filtering and CSV exporting.

---

## 🛠️ Tech Stack

*   **Frontend Client:** React 19, Vite, Lucide React (Icons), Vanilla CSS (Odoo ERP inspired aesthetic: `#234E3F` primary, charcoal backgrounds, dense tables, and sharp `2px` borders).
*   **Backend Server:** Node.js, Express, pg (PostgreSQL driver), JSON Web Tokens (Authentication), BcryptJS (Password hashing).
*   **Database:** PostgreSQL (Supabase cloud hosting).

---

## 💻 Local Development Setup

### Prerequisites
*   Node.js (v18 or higher)
*   PostgreSQL database instance

### 1. Database Setup
Create a PostgreSQL database and configure your connection string. 

### 2. Backend Installation
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` folder:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://user:password@localhost:5432/transitops
   JWT_SECRET=transitops_super_secret_token_key
   NODE_ENV=development
   ```
4. Run the database schema creation and data seeder:
   ```bash
   npm run seed
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```

### 3. Frontend Installation
1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server (proxies to port 5000):
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## 🗄️ Database Schema & Architecture

### Entity-Relationship Diagram (SQL DDL)
```sql
-- 1. USERS & ROLES
CREATE TYPE user_role AS ENUM ('FLEET_MANAGER', 'DISPATCHER', 'SAFETY_OFFICER', 'FINANCIAL_ANALYST');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    status user_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. VEHICLE REGISTRY
CREATE TYPE vehicle_status AS ENUM ('AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED');

CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    maximum_load_capacity NUMERIC(10, 2) NOT NULL,
    current_odometer NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    acquisition_cost NUMERIC(12, 2) NOT NULL,
    region VARCHAR(100) NOT NULL,
    status vehicle_status DEFAULT 'AVAILABLE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. DRIVERS & SAFETY PROFILES
CREATE TYPE driver_status AS ENUM ('AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED');

CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    license_category VARCHAR(50) NOT NULL,
    license_expiry_date DATE NOT NULL,
    contact_number VARCHAR(50) NOT NULL,
    safety_score INT DEFAULT 100 CHECK (safety_score BETWEEN 0 AND 100),
    status driver_status DEFAULT 'AVAILABLE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TRIPS
CREATE TYPE trip_status AS ENUM ('DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED');

CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    trip_code VARCHAR(50) UNIQUE NOT NULL,
    source VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id INT REFERENCES drivers(id) ON DELETE RESTRICT,
    cargo_weight NUMERIC(10, 2) NOT NULL,
    planned_distance NUMERIC(10, 2) NOT NULL,
    final_odometer NUMERIC(12, 2),
    fuel_consumed NUMERIC(8, 2),
    revenue NUMERIC(12, 2) DEFAULT 0.0,
    status trip_status DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. MAINTENANCE LOGS
CREATE TYPE maintenance_status AS ENUM ('ACTIVE', 'COMPLETED');

CREATE TABLE maintenance_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    maintenance_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    status maintenance_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. FUEL LOGS
CREATE TABLE fuel_logs (
    id SERIAL PRIMARY KEY,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_id INT REFERENCES trips(id) ON DELETE SET NULL,
    fuel_quantity_liters NUMERIC(8, 2) NOT NULL,
    fuel_cost NUMERIC(12, 2) NOT NULL,
    fuel_date DATE NOT NULL,
    odometer_reading NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. EXPENSES
CREATE TYPE expense_type AS ENUM ('TOLL', 'MAINTENANCE', 'PARKING', 'PERMIT', 'OTHER');

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    vehicle_id INT REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_id INT REFERENCES trips(id) ON DELETE SET NULL,
    expense_type expense_type NOT NULL,
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Database Indexes for Optimization
CREATE INDEX idx_vehicles_registration_number ON vehicles(registration_number);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_maintenance_status ON maintenance_logs(status);
```

---

## 🧠 Smart Dispatch Recommendation Engine

When dispatching, the engine ranks available vehicles based on the entered payload (`cargo_weight`) and route (`planned_distance`):
1. **Payload Capacity Constraint:** Eliminates vehicles where `maximum_load_capacity < cargo_weight`.
2. **Capacity Fit Score:** Prioritizes vehicles whose capacity is closest to the cargo weight to minimize empty space and maximize resource deployment.
3. **Efficiency Ratios:** Ranks vehicles by historical fuel efficiency (`total_distance_km / total_fuel_liters`) to lower estimated transit costs.
4. **Driver Alignment:** Automatically pairs the vehicle with the available driver having the highest safety score.

---

## ☁️ Cloud Deployment Guide (Production)

### 1. Database Setup (Supabase)
* Register a project at [supabase.com](https://supabase.com).
* Get your connection string (URI) from **Settings** -> **Database**.
* Replace special characters in the password (e.g. `@` as `%40`) and add the string as `DATABASE_URL` to your backend variables.

### 2. Backend Service Setup (Render)
* Register a web service at [render.com](https://render.com) and link your repository.
* Set the Root Directory to `backend`.
* Config: **Build Command:** `npm install`, **Start Command:** `node server.js`.
* Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`.

### 3. Frontend Client Setup (Vercel)
* Register a project at [vercel.com](https://vercel.com) and link your repository.
* Select `frontend` as the root folder and **Vite** as the framework preset.
* Add Environment Variable:
  * `VITE_API_URL`: `https://your-render-backend-url.onrender.com/api`

---

## 📂 Repository File Structure

| Path | File / Folder | Git Status | Purpose |
|---|---|---|---|
| `/` | `README.md` | **TRACKED** | Master specifications, setup instructions, and blueprints. |
| `/` | `.gitignore` | **TRACKED** | Defines excluded workspace files. |
| `backend/` | `package.json` | **TRACKED** | Backend metadata and run scripts. |
| `backend/` | `server.js` | **TRACKED** | API server entry script. |
| `backend/` | `src/` | **TRACKED** | Database, controllers, authentication, and router scripts. |
| `backend/` | `scripts/` | **TRACKED** | Supabase database seeder routines. |
| `backend/` | `tests/` | **TRACKED** | Backend integration testing code. |
| `frontend/` | `package.json` | **TRACKED** | Frontend dependency registry. |
| `frontend/` | `vite.config.js` | **TRACKED** | Vite compiler environment proxy configurations. |
| `frontend/` | `index.html` | **TRACKED** | Vite index HTML template. |
| `frontend/` | `src/` | **TRACKED** | React UI layouts, state contexts, style sheets, and api.js client. |
| `frontend/` | `public/` | **TRACKED** | Visual templates and assets. |
| `backend/` | `.env` | **EXCLUDED** | Private environment credential keys. |
| `backend/` | `node_modules/` | **EXCLUDED** | Node.js backend dependencies. |
| `frontend/` | `node_modules/` | **EXCLUDED** | Node.js frontend dependencies. |
| `frontend/` | `dist/` | **EXCLUDED** | Compiled production distribution folder. |
