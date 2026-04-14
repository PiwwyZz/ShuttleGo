<![CDATA[<div align="center">

# 🚐 ShuttleGo

**Real-time shuttle tracking & booking for The Clev Riverline**

A premium, mobile-first web application that provides GPS-powered shuttle tracking, seat reservations, community chat, and admin management for condominium residents (rooms 168/1 — 168/600).

![Version](https://img.shields.io/badge/version-2.0.0-black?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-RTDB-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![JavaScript](https://img.shields.io/badge/Vanilla-JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-Private-red?style=for-the-badge)

</div>

---

## ✨ Features at a Glance

<table>
<tr>
<td width="50%">

### 🗺️ Live GPS Map
Real-time shuttle position on an interactive Leaflet map with OSRM road-snapped routing, smooth marker animation, per-stop ETA calculations, and shuttle proximity indicators.

### 📅 Seat Booking
Reserve seats with time selection, pickup stop choice, and instant confirmation with a 6-character REF code. Personal pickup ETA updates in real-time when GPS is active.

### 💬 Community Chat
Real-time group messaging with role badges (Driver / Admin / Resident), unread message counter with badge notification, and auto-cleanup that keeps the last 200 messages.

</td>
<td width="50%">

### 📡 Driver GPS Panel
High-accuracy GPS broadcasting with manual speed calculation fallback, OSRM-powered navigation to the next pickup stop, accuracy filtering (skips > 200m), and warmup phase (3 fixes before broadcasting).

### 🔐 Multi-Role Auth
Three distinct user roles — **Admin**, **Driver**, and **Resident** — each with a tailored UI that shows/hides tabs and features based on permissions.

### 🔔 Smart Alerts
Browser push notifications when the shuttle is within 500m of your booked pickup stop. Automatic haptic feedback across all interactions.

</td>
</tr>
</table>

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (ES Modules) |
| **Database** | [Firebase Realtime Database](https://firebase.google.com/docs/database) (asia-southeast1) |
| **Maps** | [Leaflet.js 1.9.4](https://leafletjs.com/) + [CartoDB Basemaps](https://carto.com/basemaps) |
| **Routing** | [OSRM](http://project-osrm.org/) (road-snapped routes + single-pair ETA queries) |
| **Fonts** | [Inter](https://fonts.google.com/specimen/Inter) (UI) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (data/code) |
| **Hosting** | Any static server — GitHub Pages, Firebase Hosting, `npx serve`, etc. |

---

## 📁 Project Structure

```
ShuttleGo 2.0/
├── index.html    → Full app UI: login, map, booking, chat, driver, admin, settings
├── app.js        → All logic: Firebase, GPS, booking, chat, auth, i18n, sessions (1,373 lines)
├── style.css     → Complete design system: dark mode, 15+ animations, responsive (1,255 lines)
└── README.md     → This file
```

> **Single-page architecture** — everything runs from one HTML file with tab-based navigation and a glassmorphic bottom nav bar. No build step, no bundler, no dependencies to install.

---

## 🚀 Getting Started

### 1. Clone

```bash
git clone https://github.com/PiwwyZz/ShuttleGo.git
cd ShuttleGo
```

### 2. Serve

Any static HTTP server works:

```bash
# Node.js (recommended)
npx serve .

# Python
python3 -m http.server 8080

# VS Code → "Live Server" extension
```

### 3. Open

```
http://localhost:3000
```

> [!WARNING]
> **GPS broadcasting requires HTTPS** in most browsers. `localhost` is exempt for development, but production deployments must use HTTPS for the Driver GPS panel to work.

---

## 🔑 Authentication

### Built-in Accounts

| Role | Username | Password | Visible Tabs |
|------|----------|----------|-------------|
| 🛡️ Admin | `admin` | `admin1234` | Map · Chat · Admin · Settings |
| 🚐 Driver | `driver` | `driver1234` | Drive · Chat · Settings |

### Resident Login

Residents log in with their **room number** and **10-digit phone number**:

| Field | Format | Example |
|-------|--------|---------|
| Username | `168/{1-600}` | `168/267` |
| Password | 10-digit number | `0812345678` |

Residents see: **Map · Ride · Chat · Settings**

### How Auth Works

```
User input → regex validation → role assignment → boot()
  ├── admin:    exact match "admin" / "admin1234"
  ├── driver:   exact match "driver" / "driver1234"
  └── resident: regex /^168\/([1-9]|[1-9]\d|[1-5]\d{2}|600)$/ + /^\d{10}$/
```

On successful login:
- Role-specific UI is applied (tabs shown/hidden)
- Firebase session is registered with `onDisconnect` auto-cleanup
- Heartbeat updates `lastSeen` every 25 seconds
- Session auto-restores on page reload via `localStorage`

---

## 🗄️ Firebase Realtime Database Schema

```
Firebase RTDB (asia-southeast1)
│
├── shuttle/                    # Live GPS data (single object)
│   ├── lat: 13.823647          # Current latitude
│   ├── lng: 100.504602         # Current longitude
│   ├── speed: 8.5              # Speed in m/s (browser or calculated)
│   ├── accuracy: 12            # GPS accuracy in meters
│   ├── timestamp: 171310...    # Unix ms of last update
│   └── active: true            # Broadcasting status
│
├── bookings/                   # Seat reservations
│   └── {userId_timestamp}/
│       ├── name: "John"
│       ├── seats: 2
│       ├── time: "07:00"
│       ├── pickup: "🚇 MRT บางโพ"
│       └── ref: "A7K9P2"      # 6-char confirmation code
│
├── chats/                      # Community messages
│   └── {push_id}/
│       ├── text: "สวัสดี"
│       ├── name: "Room 168/5"
│       ├── uid: "lx8k2f..."
│       ├── role: "resident"
│       ├── time: "07:32"       # Display time
│       └── timestamp: 17131... # Sort key
│
└── sessions/                   # Active user presence
    └── {uid}/
        ├── uid: "lx8k2f..."
        ├── role: "resident"
        ├── displayName: "Room 168/5"
        ├── loginAt: 17131...
        └── lastSeen: 17131...  # Updated every 25s
```

---

## 🛣️ Shuttle Route & Stops

| # | Stop | Lat | Lng |
|---|------|-----|-----|
| 1 | 🏠 เดอะ เคลฟ ริเวอร์ไลน์ เจ้าพระยา - วงศ์สว่าง | 13.8236 | 100.5046 |
| 2 | 🏫 โรงเรียนโยธินบูรณะ | 13.8144 | 100.5208 |
| 3 | 🎓 มหาวิทยาลัยพระจอมเกล้าพระนครเหนือ (KMUTNB) | 13.8191 | 100.5141 |
| 4 | 🛒 ตลาดศรีเขมา | 13.8150 | 100.5217 |
| 5 | 🚇 MRT บางโพ | 13.8067 | 100.5214 |
| 6 | ⚓ ท่าเรือบางโพ | 13.8066 | 100.5191 |

### Daily Schedule

```
Morning    06:00  07:00  08:00  09:00  10:00  11:00
Afternoon  13:00  14:00  15:00  16:00  17:00  18:00  19:00  19:30
```

- **Total capacity:** 8 seats per trip
- **Auto-expiry:** Bookings expire 15 minutes after departure time (driver cleans them up automatically)

---

## ⚙️ System Configuration

Key constants defined in `app.js`:

| Constant | Value | Description |
|----------|-------|-------------|
| `TOTAL_SEATS` | `8` | Max seats per trip |
| `GPS_STALE_THRESHOLD_MS` | `30,000` | Signal shows "SLOW" after 30s |
| `GPS_OFFLINE_THRESHOLD_MS` | `90,000` | Signal shows "GPS OFF" after 90s |
| `OFF_ROUTE_KM` | `15` | Hide ETA if shuttle > 15km from route |
| `AVG_SPEED_MPS` | `8.3` | Fallback speed for ETA (~30 km/h) |
| `SHUTTLE_NEAR_METERS` | `500` | "Arriving!" alert threshold |
| `GPS_WRITE_INTERVAL_MS` | `3,000` | Min interval between Firebase GPS writes |
| `GPS_WARMUP_FIXES` | `3` | GPS fixes required before broadcasting |
| `GPS_ACCURACY_HARD_LIMIT` | `200` | Skip GPS readings > 200m accuracy |

---

## 🌐 Internationalization (i18n)

Full bilingual support with 45+ translation keys:

| | Language | Code | Default |
|-|----------|------|---------|
| 🇬🇧 | English | `en` | |
| 🇹🇭 | Thai (ภาษาไทย) | `th` | ✅ |

Language preference is persisted in `localStorage` (`sg_lang`). All UI strings are swapped dynamically via `data-i18n` attributes — no page reload required.

---

## 🎨 Design System

### Visual Identity

| Aspect | Implementation |
|--------|---------------|
| **Typography** | Inter (UI, 200–900 weights) + JetBrains Mono (data/metrics) |
| **Color System** | Monochrome primary (#0A0A0A / #F5F5F7) with Apple-style accents — Red (#FF3B30), Green (#34C759), Blue (#007AFF), Orange (#FF9F0A), Purple (#AF52DE) |
| **Dark Mode** | Full CSS variable theme swap. Auto-detects `prefers-color-scheme`, manual toggle, persisted in `localStorage` |
| **Layout** | Mobile-first, max-width 540px content area, safe-area insets for notched devices |
| **Glassmorphism** | `backdrop-filter: blur(20px) saturate(180%)` on navbar, bottom nav, and toasts |
| **Map Theme** | Grayscale CartoDB tiles; inverted in dark mode |

### Animations (15+ keyframes)

`fadeUp` · `fadeIn` · `slideUp` · `slideDown` · `scaleIn` · `blink` · `pulse-ring` · `spin` · `shimmer` · `gradientFlow` · `float` · `successPop` · `toastProgress` · `ripple` · `countPulse` · `dotPulse` · `meshFloat1` · `meshFloat2` · `meshFloat3`

### Interactive Feedback

- **Haptic** — `navigator.vibrate()` patterns for light, medium, and success interactions
- **Toast notifications** — Glass-style slide-in with progress bar and auto-dismiss
- **Tap scale** — 0.96 scale-down on button press
- **Booking animation** — Success checkmark with pop-in + scale sequence
- **Login transition** — Scale + fade-out on successful auth
- **Smooth marker** — Cubic ease interpolation for shuttle GPS updates (1.5s transitions)

---

## 📊 Admin Panel

The Admin tab shows:

| Widget | Description |
|--------|-------------|
| **Stats Row** | Total bookings, total seats booked, online users |
| **Active Sessions** | Live list of all connected users with role badges, login time, and online indicators. Stale sessions (> 90s) are auto-removed |
| **System Controls** | Clear all bookings, clear all chats |

---

## 🔒 Session Management

- **Presence tracking** using Firebase `onDisconnect()` — sessions are automatically removed when the browser tab closes
- **Heartbeat** every 25 seconds updates `lastSeen`
- **Stale cleanup** — Admin view prunes sessions older than 90 seconds
- **Auto-restore** — Role and display name stored in `localStorage` for seamless page reload

---

## 📱 Progressive Web App

ShuttleGo includes PWA-ready meta tags:

- `apple-mobile-web-app-capable` for iOS home screen
- `apple-mobile-web-app-status-bar-style: black-translucent`
- Dynamic `theme-color` based on color scheme
- Viewport locked: no zoom, viewport-fit cover
- Offline detection banner with auto-reconnect toast

---

## 👤 Engineered By

**Supakorn Kheiwchaoum** ([@PiwwyZz](https://github.com/PiwwyZz))

---

## 📝 License

**Private** — Built for The Clev Riverline condominium. Internal use only.
]]>
