<div align="center">

# 🚐 ShuttleGo

**Real-time shuttle tracking & booking for The Clev Riverline**

A premium, mobile-first web application that provides GPS-powered shuttle tracking, seat reservations, community chat, and admin management for condominium residents (rooms 168/1 — 168/600).

![Version](https://img.shields.io/badge/version-2.0.0-black?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-RTDB-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![JavaScript](https://img.shields.io/badge/Vanilla-JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-Private-red?style=for-the-badge)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Live GPS Map** | Real-time shuttle position on an interactive Leaflet map with OSRM road-snapped routing, smooth marker animation, per-stop ETA, and shuttle proximity indicators |
| 📅 **Seat Booking** | Reserve seats with time selection, pickup stop choice, and instant confirmation with a 6-character REF code. Personal pickup ETA updates live |
| 💬 **Community Chat** | Real-time group messaging with role badges (Driver / Admin / Resident), unread counter with badge, and auto-cleanup keeping the last 200 messages |
| 📡 **Driver GPS Panel** | High-accuracy GPS broadcasting with speed calculation fallback, OSRM navigation to next stop, accuracy filtering (skips > 200m), and 3-fix warmup phase |
| 🔐 **Multi-Role Auth** | Three roles — Admin, Driver, Resident — each with tailored UI that shows/hides tabs based on permissions |
| 🔔 **Smart Alerts** | Browser push notifications when shuttle is within 500m of your booked pickup stop. Haptic feedback on all interactions |
| 🌐 **Bilingual** | Full English / Thai (ภาษาไทย) localization with 45+ keys, switchable without reload |
| 🌙 **Dark Mode** | System-aware dark theme with manual toggle, full CSS variable swap |
| 📊 **Admin Dashboard** | Live stats, active session viewer, system controls (clear bookings/chats) |
| 📱 **PWA Ready** | iOS home screen support, offline detection, safe-area insets |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (ES Modules) |
| **Database** | [Firebase Realtime Database](https://firebase.google.com/docs/database) (asia-southeast1) |
| **Maps** | [Leaflet.js 1.9.4](https://leafletjs.com/) + [CartoDB Basemaps](https://carto.com/basemaps) |
| **Routing** | [OSRM](http://project-osrm.org/) — road-snapped routes + single-pair ETA queries |
| **Fonts** | [Inter](https://fonts.google.com/specimen/Inter) (UI) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (data) |
| **Hosting** | Any static server — GitHub Pages, Firebase Hosting, `npx serve`, etc. |

---

## 📁 Project Structure

```
ShuttleGo/
├── index.html    → Full app UI: login, map, booking, chat, driver, admin, settings
├── app.js        → All application logic (1,373 lines)
├── style.css     → Complete design system with dark mode & 15+ animations (1,255 lines)
└── README.md     → You are here
```

> **Single-page architecture** — one HTML file, tab-based navigation, glassmorphic bottom nav. No build step, no bundler, no `npm install`.

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

> ⚠️ **GPS broadcasting requires HTTPS** in most browsers. `localhost` is exempt for development, but production must use HTTPS for the Driver panel to work.

---

## 🔑 Authentication

### Built-in Accounts

| Role | Username | Password | Tabs |
|------|----------|----------|------|
| 🛡️ Admin | `admin` | `admin1234` | Map · Chat · Admin · Settings |
| 🚐 Driver | `driver` | `driver1234` | Drive · Chat · Settings |

### Resident Login

Residents log in with their **room number** and **10-digit phone number**:

| Field | Format | Example |
|-------|--------|---------|
| Username | `168/{1-600}` | `168/267` |
| Password | 10-digit number | `0812345678` |

Residents see: **Map · Ride · Chat · Settings**

### How It Works

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

## 🗄️ Firebase Database Schema

```
Firebase RTDB (asia-southeast1)
│
├── shuttle/                    # Live GPS data (single object)
│   ├── lat: 13.823647
│   ├── lng: 100.504602
│   ├── speed: 8.5              # m/s (browser or calculated)
│   ├── accuracy: 12            # meters
│   ├── timestamp: 171310...    # Unix ms
│   └── active: true
│
├── bookings/
│   └── {userId_timestamp}/
│       ├── name: "John"
│       ├── seats: 2
│       ├── time: "07:00"
│       ├── pickup: "🚇 MRT บางโพ"
│       └── ref: "A7K9P2"      # 6-char confirmation code
│
├── chats/
│   └── {push_id}/
│       ├── text: "สวัสดี"
│       ├── name: "Room 168/5"
│       ├── uid: "lx8k2f..."
│       ├── role: "resident"
│       ├── time: "07:32"
│       └── timestamp: 17131...
│
└── sessions/
    └── {uid}/
        ├── uid: "lx8k2f..."
        ├── role: "resident"
        ├── displayName: "Room 168/5"
        ├── loginAt: 17131...
        └── lastSeen: 17131...  # Updated every 25s
```

---

## 🛣️ Route & Stops

| # | Stop | Coordinates |
|---|------|-------------|
| 1 | 🏠 เดอะ เคลฟ ริเวอร์ไลน์ เจ้าพระยา - วงศ์สว่าง | 13.8236, 100.5046 |
| 2 | 🏫 โรงเรียนโยธินบูรณะ | 13.8144, 100.5208 |
| 3 | 🎓 มหาวิทยาลัยพระจอมเกล้าพระนครเหนือ (KMUTNB) | 13.8191, 100.5141 |
| 4 | 🛒 ตลาดศรีเขมา | 13.8150, 100.5217 |
| 5 | 🚇 MRT บางโพ | 13.8067, 100.5214 |
| 6 | ⚓ ท่าเรือบางโพ | 13.8066, 100.5191 |

### Daily Schedule

```
Morning    06:00  07:00  08:00  09:00  10:00  11:00
Afternoon  13:00  14:00  15:00  16:00  17:00  18:00  19:00  19:30
```

- **Capacity:** 8 seats per trip
- **Auto-expiry:** Bookings expire 15 minutes after departure time

---

## ⚙️ Configuration

Key constants in `app.js`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `TOTAL_SEATS` | `8` | Max seats per trip |
| `GPS_STALE_THRESHOLD_MS` | `30s` | GPS shows "SLOW" badge |
| `GPS_OFFLINE_THRESHOLD_MS` | `90s` | GPS shows "OFF" badge |
| `OFF_ROUTE_KM` | `15` | Hide ETA if shuttle too far |
| `AVG_SPEED_MPS` | `8.3` | Fallback ETA speed (~30 km/h) |
| `SHUTTLE_NEAR_METERS` | `500` | "Arriving!" alert trigger |
| `GPS_WRITE_INTERVAL_MS` | `3s` | Firebase write throttle |
| `GPS_WARMUP_FIXES` | `3` | Fixes before broadcasting |
| `GPS_ACCURACY_HARD_LIMIT` | `200m` | Skip inaccurate readings |

---

## 🎨 Design System

| Aspect | Details |
|--------|---------|
| **Typography** | Inter (200–900) + JetBrains Mono |
| **Colors** | Monochrome primary with Apple-style accents — Red `#FF3B30`, Green `#34C759`, Blue `#007AFF`, Orange `#FF9F0A`, Purple `#AF52DE` |
| **Dark Mode** | CSS variable swap, auto-detects `prefers-color-scheme`, manual toggle |
| **Layout** | Mobile-first, 540px max-width, safe-area insets for notched devices |
| **Glass Effects** | `backdrop-filter: blur(20px) saturate(180%)` on nav, toasts |
| **Map** | Grayscale CartoDB tiles, inverted in dark mode |

### 15+ Animations

`fadeUp` · `fadeIn` · `slideUp` · `slideDown` · `scaleIn` · `blink` · `pulse-ring` · `spin` · `shimmer` · `gradientFlow` · `float` · `successPop` · `toastProgress` · `ripple` · `countPulse` · `dotPulse` · `meshFloat1/2/3`

### Micro-Interactions

- **Haptic feedback** — vibration patterns for light, medium, success events
- **Toast system** — glassmorphic slide-in with animated progress bar
- **Tap scale** — 0.96× scale on button press
- **Booking success** — checkmark pop-in animation
- **Login dismiss** — scale + fade-out transition
- **Shuttle marker** — cubic ease interpolation over 1.5s

---

## 🔒 Session & Presence

- Firebase `onDisconnect()` auto-removes sessions on tab close
- Heartbeat pings `lastSeen` every 25 seconds
- Admin view prunes stale sessions (> 90s)
- `localStorage` stores role & name for seamless page reloads

---

## 👤 Engineered By

**Supakorn Kheiwchaoum** — [@PiwwyZz](https://github.com/PiwwyZz)

---

## 📝 License

**Private** — Built for The Clev Riverline condominium. Internal use only.
