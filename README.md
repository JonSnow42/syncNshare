# SyncNShare — Real-Time Social Music Listening Platform

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb)](https://www.mongodb.com/)

SyncNShare is a full-stack, real-time social music listening platform designed for synchronized music experiences. Users can create public or private listening lounges, invite friends, collaboratively curate a song queue, and listen in unison with low-latency host-controlled synchronization and live interactive chat.

---

## Table of Contents

1. [Architecture & Technology Stack](#1-architecture--technology-stack)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Prerequisites & Requirements](#3-prerequisites--requirements)
4. [Environment Configuration](#4-environment-configuration)
5. [Step-by-Step MongoDB Atlas Setup Guide](#5-step-by-step-mongodb-atlas-setup-guide)
6. [Local Development Guide](#6-local-development-guide)
7. [Automated Testing Suite](#7-automated-testing-suite)
8. [Multi-Client Collaboration Testing Checklist](#8-multi-client-collaboration-testing-checklist)
9. [Production Deployment Guide](#9-production-deployment-guide)
10. [Security & Architectural Guarantees](#10-security--architectural-guarantees)

---

## 1. Architecture & Technology Stack

SyncNShare uses a conventional, battle-tested MERN architecture:

### Frontend (`client/`)
- **React 18 & Vite**: Fast HMR and lightweight bundle size.
- **TypeScript**: Strict compile-time safety and type alignment with the backend.
- **Tailwind CSS**: Modern social music lounge aesthetic (dark charcoal `#090d16`, neon violet/cyan accents `#8b5cf6`, `#06b6d4`, subtle glassmorphism).
- **Socket.IO Client**: Persistent WebSocket connection with automatic reconnection and typed event listeners.
- **TanStack Query (React Query)**: Declarative server-state caching, optimistic mutations, and automatic invalidation.
- **React Router 6**: Client-side routing with protected session guards.
- **Lucide Icons**: Expressive, accessible SVG icons.

### Backend (`server/`)
- **Node.js with Express**: REST API engine under `/api/v1` for authentication, rooms, friendships, queues, and messages.
- **Socket.IO**: Authoritative real-time communication engine on the same HTTP server.
- **MongoDB with Mongoose**: Persistent storage for Users, Friendships, Rooms, Members, Queues, Playback State, and Chat.
- **Argon2id**: High-security password hashing algorithm (RFC 9106 compliant).
- **HttpOnly Cookies**: Secure session token delivery (`syncnshare_session`), protecting against XSS token theft.
- **Helmet**: Essential HTTP security headers.
- **Express Rate Limit**: Configurable rate limiting for auth endpoints and general API routes.
- **Pino & Pino-HTTP**: Structured JSON logging with dev pretty-printing.

### Shared Package (`shared/`)
- Unified TypeScript interfaces and Zod validation schemas shared between frontend and backend.

---

## 2. Monorepo Structure

```text
syncnshare/
├── package.json               # Root npm workspaces manifest
├── package-lock.json          # Pinned dependency lockfile
├── .env.example               # Root configuration template
├── .gitignore
├── README.md
├── shared/                    # Shared types & Zod schemas
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types/             # User, Room, Queue, Playback, Chat, Friend, Socket
│       └── schemas/           # Auth, Room, Queue, Chat, Friend schemas
├── server/                    # Node.js + Express + Socket.IO + Mongoose
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts           # Server bootstrap & graceful shutdown
│   │   ├── app.ts             # Express app setup (Helmet, CORS, Cookies, Routes)
│   │   ├── config/            # DB connection, env validation
│   │   ├── models/            # Mongoose schemas
│   │   ├── routes/            # /api/v1 Express routes
│   │   ├── controllers/       # Route controllers
│   │   ├── services/          # Business logic, metadata parser, presence manager
│   │   ├── socket/            # Socket.IO auth, rooms, events
│   │   ├── middlewares/       # Auth, rate-limiters, validation, error handler
│   │   └── utils/             # Pino logger, Argon2 password hasher, JWT
│   └── tests/                 # Unit, integration, and multi-client tests
└── client/                    # React + Vite + TypeScript frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── components/        # Player, Queue, Chat, MemberList, Modals
        ├── context/           # AuthContext, SocketContext
        ├── pages/             # Landing, Login, Register, Dashboard, Room, Friends
        └── services/          # Typed API client
```

---

## 3. Prerequisites & Requirements

- **Node.js**: `v20.12.0` or higher (tested on Node `v24.14.1`).
- **npm**: `v10.0.0` or higher.
- **MongoDB**: A free MongoDB Atlas cluster (or local MongoDB daemon at `mongodb://localhost:27017`).

---

## 4. Environment Configuration

Copy `.env.example` to `server/.env` and `client/.env`:

```bash
cp .env.example server/.env
cp .env.example client/.env
```

### Server Variables (`server/.env`)

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `development` | App environment (`development`, `production`, `test`). |
| `PORT` | Yes | `5000` | Port for Express & Socket.IO server. |
| `MONGODB_URI` | Yes | `mongodb+srv://...` | Persistent MongoDB connection string. |
| `CLIENT_ORIGIN` | Yes | `http://localhost:5173` | Allowed frontend origin for CORS and WebSockets. |
| `JWT_SECRET` | Yes | Secure 32+ char string | Secret used for signing session JWT tokens. |
| `COOKIE_SECRET` | Yes | Secure 32+ char string | Secret used for cookie signing. |
| `LOG_LEVEL` | No | `info` | Pino log level (`info`, `debug`, `warn`, `error`). |

### Client Variables (`client/.env`)

| Variable | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | No | `http://localhost:5000/api/v1` | Base REST API URL (defaults to Vite proxy `/api/v1` in dev). |
| `VITE_SOCKET_URL` | No | `http://localhost:5000` | Backend WebSocket endpoint. |

---

## 5. Step-by-Step MongoDB Atlas Setup Guide

Follow this guide to create and configure your personal, free MongoDB Atlas database under your own account:

### Step 1: Create Your MongoDB Atlas Account
1. Visit [MongoDB Atlas Sign Up](https://www.mongodb.com/cloud/atlas/register).
2. Register with your email address or Google account.

### Step 2: Create a Free Shared Cluster
1. In the Atlas dashboard, click **Create**.
2. Select **M0 Free** (Shared tier — 512 MB storage, shared RAM, free forever).
3. Select your preferred Cloud Provider (AWS, GCP, or Azure) and the region closest to you.
4. Set Cluster Name to `SyncNShareCluster` (or keep default `Cluster0`).
5. Click **Create Deployment**.

### Step 3: Create a Dedicated Database User
1. Under **Security** > **Database Access**, click **Add New Database User**.
2. Select **Password** Authentication Method.
3. Set a username (e.g., `syncnshare_admin`).
4. Generate or specify a strong password. **Save this password securely**.
5. Under **Database User Privileges**, select **Read and write to any database**.
6. Click **Add User**.

### Step 4: Configure Network Access
1. Under **Security** > **Network Access**, click **Add IP Address**.
2. For local development, click **Add Current IP Address** (or `0.0.0.0/0` if working across dynamic mobile/VPN networks).
3. Click **Confirm**.

### Step 5: Obtain Connection String
1. Under **Deployment** > **Database**, click **Connect** next to your cluster.
2. Select **Drivers** (Node.js).
3. Copy the connection string format:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
4. Replace `<username>` and `<password>` with your database user credentials.
5. Append the database name before the `?`, e.g. `/syncnshare`:
   ```text
   mongodb+srv://syncnshare_admin:YourPassword@cluster0.xxxx.mongodb.net/syncnshare?retryWrites=true&w=majority
   ```

### Step 6: Configure Environment
Paste your connection string into `server/.env`:
```env
MONGODB_URI=mongodb+srv://syncnshare_admin:YourPassword@cluster0.xxxx.mongodb.net/syncnshare?retryWrites=true&w=majority
```

---

## 6. Local Development Guide

### Step 1: Install Dependencies
From the repository root, install all dependencies for workspaces (`shared`, `server`, `client`):
```bash
npm install
```

### Step 2: Build the Shared Package
Compile the shared types and schemas:
```bash
npm run build --workspace=shared
```

### Step 3: Run the Development Server
Launch both the backend and frontend concurrently:
```bash
npm run dev
```
- **Backend API & WebSockets**: Runs at `http://localhost:5000`
- **Frontend Application**: Runs at `http://localhost:5173`
- **Health Check Endpoint**: Available at `http://localhost:5000/health`

---

## 7. Automated Testing Suite

SyncNShare includes an automated testing suite built with **Vitest**, **Supertest**, and **mongodb-memory-server**. Tests run in an isolated in-memory MongoDB environment, requiring zero external database credentials.

To run the entire test suite:
```bash
npm test
```

### Test Coverage Highlights:
- **Authentication**:
  - Valid user registration & HttpOnly session cookie creation.
  - Validation error handling on malformed email or weak password.
  - Rejection of duplicate email addresses.
  - Valid credential login & invalid password rejection.
  - Session restoration via `/api/v1/auth/me`.
  - Logout and session invalidation.
- **Rooms & Access Control**:
  - User A creates public room & User B discovers and joins it.
  - User A creates private room & unauthorized User B is rejected (403).
  - Private room invite-code validation and entry.
  - Friend invitation flow granting private room access.
- **Real-Time Collaboration (Critical Acceptance Test)**:
  - Two distinct authenticated Socket.IO clients connect simultaneously.
  - Client B joins Client A's listening lounge.
  - Client B adds a YouTube song to the shared queue.
  - Client A receives real-time `queue:updated` event with authoritative track info.
  - Client A (Host) plays and pauses; both clients receive real-time synchronized playback state.
  - Unauthorized non-host playback commands from Client B are rejected.
  - Bi-directional live chat delivery between Client A and Client B.

---

## 8. Multi-Client Collaboration Testing Checklist

To verify the application with two real users in separate browsers:

1. **Browser Window 1 (User A - Host)**:
   - Navigate to `http://localhost:5173`.
   - Click **Get Started** and register as `User A` (`usera@test.com`).
   - Click **Create Lounge**, name it `"Synth Lounge"`, set to **Public**, and click **Create & Enter Room**.
   - Note the room page URL (e.g., `http://localhost:5173/rooms/671...`).

2. **Browser Window 2 (Incognito / Window 2 - User B - Listener)**:
   - Navigate to `http://localhost:5173`.
   - Register as `User B` (`userb@test.com`).
   - On the **Explore Rooms** dashboard, notice `"Synth Lounge"` is visible.
   - Click **Enter** to join the room.

3. **Verify Collaboration**:
   - In Window 2, click **Add Song** in the queue. Select a sample YouTube track or paste a link.
   - Look at Window 1: User A instantly sees the song appear in the queue without reloading!
   - In Window 1 (User A), click **Play**.
   - Look at Window 2: User B's synchronized player automatically starts playback in lock-step.
   - In Window 2, type a message in the Lounge Chat and press Enter.
   - Look at Window 1: User A instantly receives the chat message in real time.
   - Repeat for User A replying to User B.

---

## 9. Production Deployment Guide

SyncNShare is designed for independent, scalable deployment of frontend and backend:

### Backend Deployment (Render / Railway / Fly.io)
> [!NOTE]
> Ensure your hosting provider supports persistent Node.js processes and WebSockets (e.g. Render Web Service, Railway, or Fly.io). Serverless function platforms like Vercel Functions do not maintain persistent WebSocket connections.

1. **Root Directory**: `server` (or repository root with workspace build).
2. **Build Command**:
   ```bash
   npm install && npm run build --workspace=shared && npm run build --workspace=server
   ```
3. **Start Command**:
   ```bash
   npm run start --workspace=server
   ```
4. **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: Assigned by host (e.g. `5000` or `10000`)
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `CLIENT_ORIGIN`: Your production frontend domain (e.g. `https://syncnshare.vercel.app`)
   - `JWT_SECRET`: Secure random 32+ character string
   - `COOKIE_SECRET`: Secure random 32+ character string

### Frontend Deployment (Vercel / Netlify / Cloudflare Pages)
1. **Root Directory**: `client`
2. **Build Command**:
   ```bash
   npm install && npm run build --workspace=shared && npm run build --workspace=client
   ```
3. **Output Directory**: `client/dist`
4. **Environment Variables**:
   - `VITE_API_BASE_URL`: `https://your-backend.onrender.com/api/v1`
   - `VITE_SOCKET_URL`: `https://your-backend.onrender.com`

---

## 10. Security & Architectural Guarantees

- **No Plaintext Passwords**: Argon2id password hashing with distinct salts.
- **XSS-Resistant Cookie Authentication**: JWT session tokens stored exclusively in `HttpOnly`, `SameSite=Lax/None` cookies; never exposed to `localStorage`.
- **Authoritative Server Clock**: Playback timeline is continuously calculated on the server using timestamp offsets; clients reconcile playback drift when exceeding 1.5 seconds.
- **SSRF Protection**: Media URL resolver rejects localhost, internal private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`), and strictly allows official media providers.
- **Strict Authorization**: Non-hosts cannot execute playback actions or alter room settings; private room Socket.IO channels reject unauthorized subscriptions.
