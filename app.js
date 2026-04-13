import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get, remove, push, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ============================================
// FIREBASE CONFIG
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyCOXSCDmSltq01NZBXVRX6uQDn0vW1ai9g",
    authDomain: "shuttlego-5ad42.firebaseapp.com",
    databaseURL: "https://shuttlego-5ad42-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "shuttlego-5ad42"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================================
// CONSTANTS
// ============================================
const TOTAL_SEATS = 8;
const GPS_STALE_THRESHOLD_MS = 30000;
const GPS_OFFLINE_THRESHOLD_MS = 90000;
const OFF_ROUTE_KM = 15;
const AVG_SPEED_MPS = 8.3;
const SHUTTLE_NEAR_METERS = 500;      // "Shuttle arriving" threshold
const SCHEDULE = ["06:00","07:00","08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","19:30"];
const STOPS = [
    { name: "🏠 เดอะ เคลฟ ริเวอร์ไลน์ เจ้าพระยา - วงศ์สว่าง", lat: 13.823647, lng: 100.504602 },
    { name: "🏫 โรงเรียนโยธินบูรณะ",       lat: 13.814412, lng: 100.520758 },
    { name: "🎓 มหาวิทยาลัยพระจอมเกล้าพระนครเหนือ",             lat: 13.819064, lng: 100.514123 },
    { name: "🛒 ตลาดศรีเขมา",     lat: 13.814968, lng: 100.521697 },
    { name: "🚇 MRT บางโพ",       lat: 13.806660, lng: 100.521430 },
    { name: "⚓ ท่าเรือบางโพ",      lat: 13.806594, lng: 100.519136 }
];

// GPS throttle config
const GPS_WRITE_INTERVAL_MS = 3000;
const GPS_WARMUP_FIXES = 3;
const GPS_ACCURACY_HARD_LIMIT = 200;
const GPS_ACCURACY_WARN_LIMIT = 100;

// ============================================
// INTERVAL TRACKING (cleanup on logout)
// ============================================
const activeIntervals = [];
function trackInterval(fn, ms) {
    const id = setInterval(fn, ms);
    activeIntervals.push(id);
    return id;
}
function clearAllIntervals() {
    activeIntervals.forEach(id => clearInterval(id));
    activeIntervals.length = 0;
}

// ============================================
// UTILS
// ============================================
function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function etaMin(distMeters, speedMps) {
    const spd = (speedMps && speedMps > 1) ? speedMps : AVG_SPEED_MPS;
    return Math.ceil(distMeters / spd / 60);
}

function generateRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref = '';
    for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
    return ref;
}

function haptic(style = 'light') {
    if ('vibrate' in navigator) {
        const patterns = { light: [10], medium: [20], success: [10, 50, 20] };
        navigator.vibrate(patterns[style] || [10]);
    }
}

// ============================================
// TOAST
// ============================================
const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

function showToast(msg, type='') {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    const iconKey = type || 'success';
    el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[iconKey] || TOAST_ICONS.success}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    haptic(type === 'error' ? 'medium' : 'light');
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-12px)';
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        setTimeout(() => el.remove(), 300);
    }, 3200);
}

// ============================================
// OFFLINE DETECTION
// ============================================
function initOfflineDetection() {
    const banner = document.getElementById('offlineBanner');
    if (!banner) return;
    const update = () => {
        if (!navigator.onLine) {
            banner.classList.add('visible');
        } else {
            banner.classList.remove('visible');
        }
    };
    window.addEventListener('online', () => { update(); showToast('Back online'); });
    window.addEventListener('offline', () => { update(); showToast('No internet connection', 'error'); });
    update();
}

// ============================================
// I18N
// ============================================
const T = {
    en: {
        app_subtitle:"The Clef Riverline", tab_track:"Map", tab_ride:"Ride", tab_chat:"Chat",
        tab_driver:"Drive", tab_admin:"Admin", tab_settings:"Menu",
        eta:"ETA", distance:"Dist", seats:"Avail", seat_unit:"seats",
        community_chat:"Community Chat",
        route_overview:"Route", next_dep:"Next Departure", reserve_seat:"Booking",
        passenger_name:"Name", select_time:"Time", pickup_loc:"Pickup Stop",
        confirm_res:"Confirm Booking", cancel_res:"Cancel Booking",
        booking_confirmed:"Confirmed", booking_success_msg:"Your seat has been reserved",
        your_eta:"Your Pickup ETA",
        waiting_gps:"Waiting for GPS...",
        today_timetable:"Schedule", sys_idle:"System Idle",
        start_broadcast:"Start Broadcasting", stop:"Stop Broadcasting",
        passenger_manifest:"Manifest", total_users:"Bookings",
        clear_sys:"System", clear_btn:"Clear All Bookings",
        preferences:"Settings", def_name:"Name", dark_mode:"Dark Mode", language:"Language",
        notifications:"Alerts",
        logout:"Sign Out", username_label:"Username / Room", password_label:"Password / Phone",
        login_btn:"Sign In", empty_manifest:"No passengers booked.",
        send:"Send", driver_away:"Driver is off route", gps_offline:"No GPS signal",
        no_messages:"No messages yet — start the conversation!",
        no_departures:"No more departures today", departing_at:"Departing at",
        shuttle_arriving:"🚐 Shuttle is arriving at your stop!",
        clear_chats:"Clear All Chats",
    },
    th: {
        app_subtitle:"เดอะเคลฟ ริเวอร์ไลน์", tab_track:"แผนที่", tab_ride:"จอง", tab_chat:"แชท",
        tab_driver:"ขับรถ", tab_admin:"แอดมิน", tab_settings:"เมนู",
        eta:"เวลา", distance:"ระยะ", seats:"ว่าง", seat_unit:"ที่นั่ง",
        community_chat:"แชทส่วนรวม",
        route_overview:"เส้นทาง", next_dep:"รอบต่อไป", reserve_seat:"จองที่นั่ง",
        passenger_name:"ชื่อผู้โดยสาร", select_time:"เวลา", pickup_loc:"จุดรับ",
        confirm_res:"ยืนยันการจอง", cancel_res:"ยกเลิกการจอง",
        booking_confirmed:"จองสำเร็จ", booking_success_msg:"จองที่นั่งเรียบร้อย",
        your_eta:"เวลาถึงจุดรับของคุณ",
        waiting_gps:"รอสัญญาณ GPS...",
        today_timetable:"ตารางรถ", sys_idle:"ระบบว่าง",
        start_broadcast:"เริ่มส่งพิกัด", stop:"หยุดส่งพิกัด",
        passenger_manifest:"รายชื่อผู้โดยสาร", total_users:"การจอง",
        clear_sys:"ระบบ", clear_btn:"ล้างข้อมูลทั้งหมด",
        preferences:"ตั้งค่า", def_name:"ชื่อ", dark_mode:"โหมดมืด", language:"ภาษา",
        notifications:"การแจ้งเตือน",
        logout:"ออกระบบ", username_label:"ชื่อผู้ใช้ / ห้อง", password_label:"รหัสผ่าน / เบอร์โทร",
        login_btn:"เข้าสู่ระบบ", empty_manifest:"ไม่มีคิว",
        send:"ส่ง", driver_away:"คนขับอยู่นอกเส้นทาง", gps_offline:"ไม่มีสัญญาณ GPS",
        no_messages:"ยังไม่มีข้อความ — เริ่มสนทนาเลย!",
        no_departures:"ไม่มีรอบรถวันนี้แล้ว", departing_at:"ออกเวลา",
        shuttle_arriving:"🚐 รถกำลังมาถึงจุดรับของคุณ!",
        clear_chats:"ล้างแชททั้งหมด",
    }
};
let lang = localStorage.getItem('sg_lang') || 'th';

function changeLang(l) {
    lang = l;
    localStorage.setItem('sg_lang', l);
    document.getElementById('btn-en').className = 'lang-btn ' + (l==='en' ? 'active' : 'inactive');
    document.getElementById('btn-th').className = 'lang-btn ' + (l==='th' ? 'active' : 'inactive');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (T[l][key] !== undefined) el.textContent = T[l][key];
    });
    buildSchedule();
    rebuildPickupOptions();
}

// ============================================
// DARK MODE
// ============================================
function toggleDark(on) {
    if (on) document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('sg_dark', on ? '1' : '0');
    haptic();
}

function initDarkMode() {
    const stored = localStorage.getItem('sg_dark');
    if (stored === '1') {
        document.documentElement.setAttribute('data-theme','dark');
    } else if (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme','dark');
    }
    const toggle = document.getElementById('darkToggle');
    if (toggle) toggle.checked = document.documentElement.hasAttribute('data-theme');
}

// ============================================
// AUTH
// ============================================
let currentRole = null;
let currentDisplayName = '';
let currentUserId = null;

function handleLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.classList.add('loading');

    setTimeout(() => {
        if (user === 'admin' && pass === 'admin1234') {
            boot('admin', 'Admin');
        } else if (user === 'driver' && pass === 'driver1234') {
            boot('driver', 'Driver');
        } else if (/^168\/([1-9]|[1-9][0-9]|[1-5][0-9]{2}|600)$/.test(user) && /^\d{10}$/.test(pass)) {
            boot('resident', `Room ${user}`);
        } else {
            showToast('Invalid credentials', 'error');
            haptic('medium');
            if (loginBtn) loginBtn.classList.remove('loading');
        }
    }, 500);
}

function boot(role, displayName) {
    currentRole = role;
    currentUserId = localStorage.getItem('sg_uid') || (Date.now().toString(36) + Math.random().toString(36).slice(2));
    localStorage.setItem('sg_uid', currentUserId);

    const savedName = localStorage.getItem('sg_name') || '';
    currentDisplayName = savedName || displayName;
    localStorage.setItem('sg_role', role);
    localStorage.setItem('sg_display', displayName);

    applyRoleUI(role);
    haptic('success');

    // Smooth login dismiss
    const loginScreen = document.getElementById('loginScreen');
    loginScreen.classList.add('hiding');
    setTimeout(() => {
        loginScreen.style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
    }, 500);

    const settingName = document.getElementById('settingName');
    const nameInput = document.getElementById('nameInput');
    if (settingName) settingName.value = savedName;
    if (nameInput) nameInput.value = savedName;
    changeLang(lang);

    if (role === 'resident' || role === 'admin') {
        setTimeout(initMap, 150);
        switchTab('resident');
    } else if (role === 'driver') {
        switchTab('driver');
        checkHTTPS();
    } else {
        switchTab('admin');
    }

    registerSession(role, displayName);
    initBookingState();
    listenBookings();
    listenGPS();
    listenChat();
    if (role === 'admin') listenSessions();

    if (role === 'resident' || role === 'admin') {
        startStaleCheckTimer();
    }

    trackInterval(updateCountdown, 1000);
    trackInterval(buildSchedule, 30000);

    // Notifications setting
    const notifToggle = document.getElementById('notifToggle');
    if (notifToggle) {
        notifToggle.checked = localStorage.getItem('sg_notif') !== '0';
        notifToggle.addEventListener('change', function() {
            localStorage.setItem('sg_notif', this.checked ? '1' : '0');
        });
    }
}

function checkHTTPS() {
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecure) document.getElementById('httpsBanner').style.display = 'block';
}

function applyRoleUI(role) {
    const show = (id, visible) => {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? 'flex' : 'none';
    };
    show('nav-resident', role === 'resident' || role === 'admin');
    show('nav-ride', role === 'resident');
    show('nav-driver', role === 'driver');
    show('nav-admin', role === 'admin');
    show('nav-chat', true);
    show('nav-settings', true);
    const nameRow = document.getElementById('nameSettingRow');
    if (nameRow) nameRow.style.display = role === 'resident' ? 'flex' : 'none';
}

function handleLogout() {
    if (currentRole === 'driver') stopSharing();
    if (currentUserId) {
        try { remove(ref(db, 'sessions/' + currentUserId)); } catch(e) {}
    }
    clearAllIntervals();
    localStorage.removeItem('sg_role');
    localStorage.removeItem('sg_display');
    window.location.reload();
}

// ============================================
// SESSION PRESENCE
// ============================================
function registerSession(role, displayName) {
    if (!currentUserId) return;
    const sessionRef = ref(db, 'sessions/' + currentUserId);
    const sessionData = {
        uid: currentUserId, role,
        displayName: currentDisplayName || displayName,
        loginAt: Date.now(), lastSeen: Date.now()
    };
    set(sessionRef, sessionData).catch(() => {});
    onDisconnect(sessionRef).remove();
    trackInterval(() => {
        set(ref(db, 'sessions/' + currentUserId + '/lastSeen'), Date.now()).catch(() => {});
    }, 25000);
}

function listenSessions() {
    const STALE_MS = 90000;
    onValue(ref(db, 'sessions'), (snap) => {
        const data = snap.val();
        const sessionList = document.getElementById('sessionList');
        const now = Date.now();
        if (!data) {
            sessionList.innerHTML = `<div class="empty-state">No users online.</div>`;
            document.getElementById('sessionCount').textContent = '0 online';
            document.getElementById('adminOnline').textContent = '0';
            return;
        }
        const sessions = Object.values(data);
        sessions.forEach(s => {
            if (now - (s.lastSeen || s.loginAt) > STALE_MS)
                remove(ref(db, 'sessions/' + s.uid)).catch(() => {});
        });
        const live = sessions.filter(s => now - (s.lastSeen || s.loginAt) <= STALE_MS);
        live.sort((a, b) => {
            const order = { driver: 0, admin: 1, resident: 2 };
            return (order[a.role] ?? 3) - (order[b.role] ?? 3);
        });
        document.getElementById('sessionCount').textContent = `${live.length} online`;
        document.getElementById('adminOnline').textContent = live.length;
        const ROLE_ICON = { resident: '🏠', driver: '🚐', admin: '⚙️' };
        const ROLE_BADGE = { resident: 'badge-resident', driver: 'badge-driver', admin: 'badge-admin' };
        const ROLE_LABEL = { resident: 'Resident', driver: 'Driver', admin: 'Admin' };
        sessionList.innerHTML = live.map(s => {
            const ageMin = Math.floor((now - s.loginAt) / 60000);
            const ageTxt = ageMin < 1 ? 'Just now' : ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin/60)}h ago`;
            return `<div class="session-row">
                <div class="session-avatar">${ROLE_ICON[s.role] || '👤'}</div>
                <div class="session-info">
                    <div class="session-name">${esc(s.displayName)}</div>
                    <div class="session-meta">Logged in ${ageTxt}</div>
                </div>
                <span class="session-badge ${ROLE_BADGE[s.role] || ''}">${ROLE_LABEL[s.role] || s.role}</span>
                <div class="session-online-dot"></div>
            </div>`;
        }).join('') || `<div class="empty-state">No users online.</div>`;
    });
}

function saveNameSetting(val) {
    localStorage.setItem('sg_name', val);
    currentDisplayName = val || localStorage.getItem('sg_display') || '';
    document.getElementById('nameInput').value = val;
    if (currentUserId)
        set(ref(db, 'sessions/' + currentUserId + '/displayName'), currentDisplayName).catch(() => {});
}

// ============================================
// SHOW / HIDE PASSWORD
// ============================================
function togglePasswordVisibility() {
    const input = document.getElementById('loginPass');
    const btn = document.getElementById('togglePwBtn');
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    } else {
        input.type = 'password';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
}

// ============================================
// TAB SWITCHER
// ============================================
let currentTab = null;
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const tabEl = document.getElementById('tab-' + tab);
    const navEl = document.getElementById('nav-' + tab);
    if (tabEl) tabEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    currentTab = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    haptic();
    if (map && (tab === 'resident' || tab === 'admin'))
        setTimeout(() => map.invalidateSize(), 280);
    if (tab === 'chat') {
        // Mark messages as read when opening chat
        lastReadChatCount = totalChatCount;
        updateChatBadge();
        setTimeout(() => {
            const cb = document.getElementById('chatBox');
            cb.scrollTop = cb.scrollHeight;
        }, 100);
    }
}

// ============================================
// MAP + OSRM
// ============================================
let map = null, shuttleMarker = null, markerLatLng = null;
let routePolyline = null;
let roadLegs = [];
let fullRouteLatLngs = [];

async function fetchOSRMRoute(waypoints) {
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const json = await res.json();
        if (json.code !== 'Ok' || !json.routes.length) throw new Error('No route');
        const route = json.routes[0];
        const latLngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
        const legs = route.legs.map(l => ({ distance: l.distance, duration: l.duration }));
        return { latLngs, legs, totalDistance: route.distance, totalDuration: route.duration };
    } catch(e) {
        console.warn('OSRM route failed:', e.message);
        return null;
    }
}

let osrmFailCount = 0;
const OSRM_MAX_FAILS = 3;
let osrmPauseUntil = 0;

async function fetchOSRMSingle(fromLat, fromLng, toLat, toLng) {
    if (Date.now() < osrmPauseUntil) return null;
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const json = await res.json();
        if (json.code !== 'Ok' || !json.routes.length) return null;
        osrmFailCount = 0;
        return { distance: json.routes[0].distance, duration: json.routes[0].duration };
    } catch(e) {
        osrmFailCount++;
        if (osrmFailCount >= OSRM_MAX_FAILS) {
            osrmPauseUntil = Date.now() + 60000;
            osrmFailCount = 0;
        }
        return null;
    }
}

function centerMapOnShuttle() {
    if (map && markerLatLng) {
        map.flyTo([markerLatLng.lat, markerLatLng.lng], 16, { duration: 0.8 });
        haptic();
    }
}

function fitMapToRoute() {
    if (map && routePolyline) {
        map.fitBounds(routePolyline.getBounds(), { padding: [32, 32] });
        haptic();
    }
}

async function initMap() {
    if (map) { map.invalidateSize(); return; }
    map = L.map('map', { zoomControl: false, attributionControl: false })
            .setView([STOPS[0].lat, STOPS[0].lng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    STOPS.forEach((stop, i) => {
        const color = i === 0 ? '#0A0A0A' : i === STOPS.length-1 ? '#FF3B30' : '#6E6E73';
        L.circleMarker([stop.lat, stop.lng], {
            radius: i === 0 || i === STOPS.length-1 ? 7 : 5,
            fillColor: color, color: '#fff',
            weight: 2.5, fillOpacity: 1
        }).bindTooltip(stop.name, { permanent: false, direction: 'top' }).addTo(map);
    });

    const straightCoords = STOPS.map(s => [s.lat, s.lng]);
    routePolyline = L.polyline(straightCoords, { color: '#bbb', weight: 3, opacity: 0.5, dashArray: '6,6' }).addTo(map);
    map.fitBounds(routePolyline.getBounds(), { padding: [32, 32] });

    const vanIcon = L.divIcon({
        html: `<div style="background:#0A0A0A;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 4px 14px rgba(0,0,0,0.35);border:2.5px solid #fff;">🚐</div>`,
        className: '', iconSize: [34, 34], iconAnchor: [17, 17]
    });
    shuttleMarker = L.marker([-90, 0], { icon: vanIcon, zIndexOffset: 1000 }).addTo(map);

    const osrm = await fetchOSRMRoute(STOPS);
    if (osrm) {
        fullRouteLatLngs = osrm.latLngs;
        roadLegs = osrm.legs;
        map.removeLayer(routePolyline);
        routePolyline = L.polyline(fullRouteLatLngs, { color: '#0A0A0A', weight: 3.5, opacity: 0.7 }).addTo(map);
        map.fitBounds(routePolyline.getBounds(), { padding: [32, 32] });
    } else {
        routePolyline.setStyle({ color: '#0A0A0A', opacity: 0.6, dashArray: null });
    }
}

// ============================================
// GPS SYSTEM — DRIVER
// ============================================
let watchId = null, isSharing = false;
let gpsFixCount = 0, lastFirebaseWrite = 0;
let lastGPSPosition = null, lastGPSTimestamp = 0;
let calculatedSpeed = null;

async function checkGPSPermission() {
    if (!navigator.permissions) return 'unknown';
    try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state;
    } catch(e) {
        console.warn('Permission query failed:', e);
        return 'unknown';
    }
}

async function startSharing() {
    if (!navigator.geolocation) { showToast('GPS ไม่รองรับบนอุปกรณ์นี้', 'error'); return; }
    if (isSharing) return;

    const permState = await checkGPSPermission();
    if (permState === 'denied') {
        document.getElementById('gpsPermBanner').style.display = 'block';
        showToast('GPS ถูกปฏิเสธ — กรุณาเปิดสิทธิ์ Location', 'error');
        return;
    }

    isSharing = true;
    gpsFixCount = 0;
    lastGPSPosition = null;
    calculatedSpeed = null;

    document.getElementById('driverStatusText').textContent = 'กำลังเตรียม GPS...';
    document.getElementById('driverIndicator').className = 'driver-status-indicator active';
    document.getElementById('driverIndicator').textContent = '';
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'block';
    document.getElementById('navTargetBox').style.display = 'block';
    document.getElementById('gpsPermBanner').style.display = 'none';
    document.getElementById('httpsBanner').style.display = 'none';
    showToast('เริ่มส่งพิกัด GPS แล้ว');

    set(ref(db, 'shuttle/active'), true).catch(() => {});
    onDisconnect(ref(db, 'shuttle/active')).set(false);

    watchId = navigator.geolocation.watchPosition(onGPSSuccess, onGPSError, {
        enableHighAccuracy: true, timeout: 20000, maximumAge: 3000
    });
}

let lastOSRMCall = 0;
const OSRM_THROTTLE_MS = 8000;

async function onGPSSuccess(pos) {
    const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;
    const timestamp = Date.now();
    gpsFixCount++;

    document.getElementById('driverCoords').textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById('driverAcc').textContent = accuracy ? `±${Math.round(accuracy)}m` : '';

    if (accuracy && accuracy > GPS_ACCURACY_HARD_LIMIT) {
        document.getElementById('driverAcc').textContent += ' (skipped)';
        return;
    }
    if (accuracy && accuracy > GPS_ACCURACY_WARN_LIMIT) {
        document.getElementById('driverAcc').textContent += ' (weak)';
    }

    if (gpsFixCount <= GPS_WARMUP_FIXES) {
        document.getElementById('driverStatusText').textContent = `GPS Warming Up (${gpsFixCount}/${GPS_WARMUP_FIXES})...`;
    } else {
        document.getElementById('driverStatusText').textContent = 'Broadcasting GPS';
    }

    // Manual speed calc
    let effectiveSpeed = speed;
    if ((!speed || speed < 0) && lastGPSPosition && lastGPSTimestamp) {
        const dt = (timestamp - lastGPSTimestamp) / 1000;
        if (dt > 0 && dt < 30) {
            const dist = haversine(lastGPSPosition.lat, lastGPSPosition.lng, lat, lng);
            calculatedSpeed = dist / dt;
            effectiveSpeed = calculatedSpeed;
        }
    }
    lastGPSPosition = { lat, lng };
    lastGPSTimestamp = timestamp;

    // Show speed
    const speedEl = document.getElementById('driverSpeed');
    if (speedEl && effectiveSpeed && effectiveSpeed > 0.5) {
        speedEl.style.display = 'inline-block';
        speedEl.textContent = `${Math.round(effectiveSpeed * 3.6)} km/h`;
    } else if (speedEl) {
        speedEl.style.display = 'inline-block';
        speedEl.textContent = '0 km/h';
    }

    // Throttle writes
    if (timestamp - lastFirebaseWrite < GPS_WRITE_INTERVAL_MS) return;
    lastFirebaseWrite = timestamp;

    set(ref(db, 'shuttle'), {
        lat, lng,
        speed: effectiveSpeed || null,
        accuracy: accuracy || null,
        timestamp,
        active: true
    }).catch(() => {});

    // Nav target
    const target = window._driverTarget || STOPS[0];
    document.getElementById('navTargetName').textContent = target.name;
    document.getElementById('navAcc').textContent = accuracy ? `±${Math.round(accuracy)}m` : '—';

    const now = Date.now();
    if (now - lastOSRMCall > OSRM_THROTTLE_MS) {
        lastOSRMCall = now;
        const road = await fetchOSRMSingle(lat, lng, target.lat, target.lng);
        if (road) {
            document.getElementById('navETA').textContent = `${Math.ceil(road.duration / 60)} min`;
            document.getElementById('navDist').textContent = `${(road.distance / 1000).toFixed(1)} km`;
        } else {
            const dist = haversine(lat, lng, target.lat, target.lng);
            document.getElementById('navETA').textContent = `~${etaMin(dist, effectiveSpeed)} min`;
            document.getElementById('navDist').textContent = `~${(dist/1000).toFixed(1)} km`;
        }
    }
}

function onGPSError(err) {
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    switch (err.code) {
        case 1:
            if (!isSecure) {
                document.getElementById('httpsBanner').style.display = 'block';
                showToast('GPS ใช้ไม่ได้ — อาจต้องใช้ HTTPS', 'error');
            } else {
                document.getElementById('gpsPermBanner').style.display = 'block';
                showToast('GPS ถูกปฏิเสธ — กรุณาเปิดสิทธิ์ Location', 'error');
            }
            stopSharing();
            break;
        case 2: showToast('ไม่มีสัญญาณ GPS — ลองไปที่โล่งๆ', 'warning'); break;
        case 3: showToast('GPS หมดเวลา — กำลังลองใหม่...', 'warning'); break;
        default: showToast(`GPS Error: ${err.message}`, 'error');
    }
}

function stopSharing() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    isSharing = false; gpsFixCount = 0;
    lastGPSPosition = null; calculatedSpeed = null;

    set(ref(db, 'shuttle/active'), false).catch(() => {});
    onDisconnect(ref(db, 'shuttle/active')).cancel();

    document.getElementById('driverStatusText').textContent = T[lang].sys_idle;
    document.getElementById('driverCoords').textContent = 'GPS Offline';
    document.getElementById('driverAcc').textContent = '';
    document.getElementById('driverIndicator').className = 'driver-status-indicator';
    document.getElementById('driverIndicator').textContent = '🔴';
    document.getElementById('driverSpeed').style.display = 'none';
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('navTargetBox').style.display = 'none';
    showToast('หยุดส่งพิกัดแล้ว');
}

// ============================================
// GPS LISTENER (Resident/Admin)
// ============================================
let lastResidentOSRM = 0;
const RESIDENT_OSRM_THROTTLE = 10000;
let lastKnownGPSTimestamp = 0;
let shuttleAlertShown = false;

function listenGPS() {
    onValue(ref(db, 'shuttle'), (snap) => {
        const data = snap.val();
        if (!data) { setGPSOffline(); return; }

        const now = Date.now();
        const ts = data.timestamp || 0;
        const age = now - ts;
        const active = data.active !== false;
        lastKnownGPSTimestamp = ts;

        if (!active || age > GPS_OFFLINE_THRESHOLD_MS || !data.lat) { setGPSOffline(); return; }
        if (age > GPS_STALE_THRESHOLD_MS) setGPSStale(ts);
        else setGPSOnline(ts);

        // Driver role only cares about shuttle/active state, not map UI
        if (currentRole === 'driver') return;

        if (data.lat && data.lng) animateMarker(data.lat, data.lng);

        // Update route list with shuttle proximity
        updateRouteWithShuttlePosition(data.lat, data.lng);

        const etaEl = document.getElementById('etaVal');
        const distEl = document.getElementById('distVal');

        const distFromOrigin = haversine(STOPS[0].lat, STOPS[0].lng, data.lat, data.lng);
        if (distFromOrigin > OFF_ROUTE_KM * 1000) {
            if (etaEl) { etaEl.textContent = '—'; etaEl.classList.add('stale'); }
            if (distEl) { distEl.textContent = '—'; distEl.classList.add('stale'); }
            updatePersonalETA(null, null);
            hideShuttleAlert();
            return;
        }

        const distToOrigin = haversine(data.lat, data.lng, STOPS[0].lat, STOPS[0].lng);
        if (etaEl) { etaEl.textContent = etaMin(distToOrigin, data.speed); etaEl.classList.remove('stale'); }
        if (distEl) { distEl.textContent = (distToOrigin/1000).toFixed(1); distEl.classList.remove('stale'); }

        // Check if shuttle is near the user's pickup stop
        checkShuttleProximity(data);

        if (now - lastResidentOSRM > RESIDENT_OSRM_THROTTLE) {
            lastResidentOSRM = now;
            fetchOSRMSingle(data.lat, data.lng, STOPS[0].lat, STOPS[0].lng).then(road => {
                if (road) {
                    if (etaEl) etaEl.textContent = Math.ceil(road.duration / 60);
                    if (distEl) distEl.textContent = (road.distance/1000).toFixed(1);
                }
            });
            if (personalStop) {
                fetchOSRMSingle(data.lat, data.lng, personalStop.lat, personalStop.lng).then(road => {
                    const el = document.getElementById('personalETA');
                    if (!el) return;
                    if (road) {
                        el.textContent = `${Math.ceil(road.duration / 60)} min`;
                        el.className = 'personal-eta-value';
                    } else {
                        updatePersonalETA(data, data.speed);
                    }
                });
            }
        } else {
            updatePersonalETA(data, data.speed);
        }
    });
}

// ============================================
// SHUTTLE PROXIMITY ALERTS
// ============================================
function checkShuttleProximity(gpsData) {
    if (!personalStop || !gpsData) return;
    if (localStorage.getItem('sg_notif') === '0') return;

    const dist = haversine(gpsData.lat, gpsData.lng, personalStop.lat, personalStop.lng);
    if (dist < SHUTTLE_NEAR_METERS && !shuttleAlertShown) {
        shuttleAlertShown = true;
        showShuttleAlert();
        haptic('success');
        // Try browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('ShuttleGo', { body: T[lang].shuttle_arriving, icon: '🚐' });
        }
    } else if (dist > SHUTTLE_NEAR_METERS * 2) {
        shuttleAlertShown = false;
        hideShuttleAlert();
    }
}

function showShuttleAlert() {
    const el = document.getElementById('shuttleAlert');
    if (el) el.classList.add('visible');
}
function hideShuttleAlert() {
    const el = document.getElementById('shuttleAlert');
    if (el) el.classList.remove('visible');
}

// ============================================
// ROUTE WITH SHUTTLE POSITION
// ============================================
function updateRouteWithShuttlePosition(lat, lng) {
    if (!lat || !lng) return;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    STOPS.forEach((stop, i) => {
        const dist = haversine(lat, lng, stop.lat, stop.lng);
        if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    });

    document.querySelectorAll('.route-item').forEach((item, i) => {
        const dot = item.querySelector('.route-dot');
        if (i === nearestIdx && nearestDist < 2000) {
            item.classList.add('shuttle-near');
            if (dot && !dot.classList.contains('origin') && !dot.classList.contains('dest'))
                dot.classList.add('shuttle-near');
        } else {
            item.classList.remove('shuttle-near');
            if (dot) dot.classList.remove('shuttle-near');
        }
    });

    // Update ETA per stop
    STOPS.forEach((stop, i) => {
        const etaEl = document.querySelector(`.route-item:nth-child(${i+1}) .route-eta`);
        if (etaEl) {
            const dist = haversine(lat, lng, stop.lat, stop.lng);
            if (dist < 200) {
                etaEl.textContent = '● Here';
                etaEl.className = 'route-eta live';
            } else {
                etaEl.textContent = `~${etaMin(dist)} min · ${(dist/1000).toFixed(1)} km`;
                etaEl.className = 'route-eta';
            }
        }
    });
}

function startStaleCheckTimer() {
    trackInterval(() => {
        if (!lastKnownGPSTimestamp) return;
        const age = Date.now() - lastKnownGPSTimestamp;
        if (age > GPS_OFFLINE_THRESHOLD_MS) setGPSOffline();
        else if (age > GPS_STALE_THRESHOLD_MS) setGPSStale(lastKnownGPSTimestamp);
    }, 10000);
}

function setGPSOnline(ts) {
    lastKnownGPSTimestamp = ts;
    const badge = document.getElementById('gpsBadge');
    if (badge) {
        badge.className = 'live-pill';
        badge.innerHTML = `<div class="live-dot"></div><span>LIVE</span>`;
    }
    const banner = document.getElementById('gpsBanner');
    if (banner) {
        banner.className = 'gps-banner online';
        banner.innerHTML = `<div class="gps-pulse"><div class="gps-pulse-dot"></div><div class="gps-pulse-ring"></div></div><span>GPS Active</span>`;
    }
}

function setGPSStale(ts) {
    const secAgo = Math.round((Date.now() - ts) / 1000);
    const badge = document.getElementById('gpsBadge');
    if (badge) {
        badge.className = 'gps-offline-pill';
        badge.innerHTML = `<div style="width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0;"></div><span id="gpsBadgeText">SLOW</span>`;
    }
    const banner = document.getElementById('gpsBanner');
    if (banner) {
        banner.className = 'gps-banner stale';
        banner.innerHTML = `<div class="gps-pulse"><div class="gps-pulse-dot"></div></div><span>Signal weak (${secAgo}s ago)</span>`;
    }
}

function setGPSOffline() {
    const badge = document.getElementById('gpsBadge');
    if (badge) {
        badge.className = 'gps-offline-pill';
        badge.innerHTML = `<div style="width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0;"></div><span id="gpsBadgeText">GPS OFF</span>`;
    }
    const banner = document.getElementById('gpsBanner');
    if (banner) {
        banner.className = 'gps-banner offline';
        banner.innerHTML = `<div class="gps-pulse"><div class="gps-pulse-dot"></div></div><span>${T[lang].gps_offline}</span>`;
    }
    const etaEl = document.getElementById('etaVal');
    const distEl = document.getElementById('distVal');
    if (etaEl) { etaEl.textContent = '--'; etaEl.classList.add('stale'); }
    if (distEl) { distEl.textContent = '--'; distEl.classList.add('stale'); }
    hideShuttleAlert();
    const personalEl = document.getElementById('personalETA');
    if (personalEl && personalStop) {
        personalEl.textContent = T[lang].gps_offline;
        personalEl.className = 'personal-eta-value waiting';
    }
    // Clear route ETAs
    document.querySelectorAll('.route-eta').forEach(el => { el.textContent = ''; el.className = 'route-eta'; });
    document.querySelectorAll('.route-item').forEach(el => el.classList.remove('shuttle-near'));
    document.querySelectorAll('.route-dot.shuttle-near').forEach(el => el.classList.remove('shuttle-near'));
}

// Smooth marker animation
let animFrame = null, markerStart = null, markerEnd = null, animStartTime = null;
const ANIM_DURATION = 1500;

function animateMarker(toLat, toLng) {
    if (!shuttleMarker) return;
    const cur = shuttleMarker.getLatLng();
    if (cur.lat === -90) {
        shuttleMarker.setLatLng([toLat, toLng]);
        markerLatLng = { lat: toLat, lng: toLng };
        return;
    }
    markerStart = { lat: cur.lat, lng: cur.lng };
    markerEnd = { lat: toLat, lng: toLng };
    animStartTime = performance.now();
    if (animFrame) cancelAnimationFrame(animFrame);
    function step(now) {
        const t = Math.min((now - animStartTime) / ANIM_DURATION, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        shuttleMarker.setLatLng([
            markerStart.lat + (markerEnd.lat - markerStart.lat) * ease,
            markerStart.lng + (markerEnd.lng - markerStart.lng) * ease
        ]);
        if (t < 1) animFrame = requestAnimationFrame(step);
        else markerLatLng = { lat: toLat, lng: toLng };
    }
    animFrame = requestAnimationFrame(step);
}

function updatePersonalETA(gpsData, speed) {
    if (!personalStop) return;
    const el = document.getElementById('personalETA');
    if (!el) return;
    if (!gpsData) { el.textContent = T[lang].driver_away; el.className = 'personal-eta-value waiting'; return; }
    const dist = haversine(gpsData.lat, gpsData.lng, personalStop.lat, personalStop.lng);
    if (dist / 1000 > OFF_ROUTE_KM) {
        el.textContent = T[lang].driver_away; el.className = 'personal-eta-value waiting';
    } else {
        el.textContent = `${etaMin(dist, speed)} min`; el.className = 'personal-eta-value';
    }
}

// ============================================
// ROUTE LIST & SCHEDULE
// ============================================
function buildRoute() {
    const list = document.getElementById('routeList');
    list.innerHTML = '';
    document.getElementById('routeStopsCount').textContent = `${STOPS.length} stops`;
    STOPS.forEach((stop, i) => {
        const dotClass = i === 0 ? 'origin' : i === STOPS.length-1 ? 'dest' : '';
        list.innerHTML += `<div class="route-item">
            <div class="route-dot ${dotClass}"></div>
            <div class="route-info">
                <div class="route-name">${stop.name}</div>
                <div class="route-eta"></div>
            </div>
        </div>`;
    });
    rebuildPickupOptions();
}

function rebuildPickupOptions() {
    const sel = document.getElementById('pickupInput');
    if (!sel) return;
    sel.innerHTML = '';
    STOPS.forEach(stop => {
        const opt = document.createElement('option');
        opt.value = stop.name; opt.textContent = stop.name;
        sel.appendChild(opt);
    });
}

function buildSchedule() {
    const now = new Date();
    const sl = document.getElementById('scheduleList');
    const ti = document.getElementById('timeInput');
    if (!sl || !ti) return;
    sl.innerHTML = ''; ti.innerHTML = '';
    let nextSet = false;
    SCHEDULE.forEach(time => {
        const [h,m] = time.split(':').map(Number);
        const dep = new Date(); dep.setHours(h,m,0,0);
        const isPast = dep < now;
        const isNext = !isPast && !nextSet;
        if (isNext) nextSet = true;
        let badge = `<span class="schedule-badge">${isPast ? '—' : 'Open'}</span>`;
        if (isNext) badge = `<span class="schedule-badge next-badge">Next</span>`;
        sl.innerHTML += `<div class="schedule-row ${isPast?'past':''}">\n<span class="schedule-time">${time}</span>\n${badge}\n</div>`;
        if (!isPast) {
            const opt = document.createElement('option');
            opt.value = time; opt.textContent = time;
            ti.appendChild(opt);
        }
    });
}

function updateCountdown() {
    const now = new Date();
    let next = null;
    for (const time of SCHEDULE) {
        const [h,m] = time.split(':').map(Number);
        const dep = new Date(); dep.setHours(h,m,0,0);
        if (dep > now) { next = { dep, time }; break; }
    }
    const cdEl = document.getElementById('countdown');
    const nlEl = document.getElementById('nextDepLabel');
    if (next) {
        const diff = next.dep - now;
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        cdEl.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        nlEl.textContent = `${T[lang].departing_at || 'Departing at'} ${next.time}`;
    } else {
        cdEl.textContent = '--:--';
        nlEl.textContent = T[lang].no_departures || 'No more departures today';
    }
}

// ============================================
// BOOKING SYSTEM
// ============================================
let myBookingKey = localStorage.getItem('sg_bkey') || null;
let myBookingRef = localStorage.getItem('sg_bref') || null;
let personalStop = null;
window._driverTarget = null;

function listenBookings() {
    onValue(ref(db, 'bookings'), (snap) => {
        const data = snap.val();
        let bookedSeats = 0, totalUsers = 0;
        let manifestHTML = '';
        let nextTarget = null;
        const now = new Date();

        if (data) {
            const entries = Object.entries(data).sort((a,b) => a[1].time.localeCompare(b[1].time));
            entries.forEach(([key, b]) => {
                const [h,m] = b.time.split(':').map(Number);
                const depTime = new Date(); depTime.setHours(h,m,0,0);
                const expiry = new Date(depTime.getTime() + 15*60000);
                if (currentRole === 'driver' && now > expiry) {
                    remove(ref(db, 'bookings/' + key)).catch(() => {});
                    if (key === myBookingKey) { myBookingKey = null; localStorage.removeItem('sg_bkey'); }
                    return;
                }
                if (now > expiry) return;
                if (!nextTarget) nextTarget = STOPS.find(s => s.name === b.pickup) || STOPS[0];
                totalUsers++;
                bookedSeats += b.seats;
                manifestHTML += `<div class="manifest-card">
                    <div class="manifest-pickup">${esc(b.pickup)}</div>
                    <div class="manifest-row">
                        <span class="manifest-name">${esc(b.name)}</span>
                        <span class="manifest-meta">${esc(b.time)} · ${b.seats} pax</span>
                    </div>
                </div>`;
                if (key === myBookingKey) personalStop = STOPS.find(s => s.name === b.pickup) || STOPS[0];
            });
        }

        if (myBookingKey && data && !data[myBookingKey]) {
            myBookingKey = null; myBookingRef = null;
            localStorage.removeItem('sg_bkey'); localStorage.removeItem('sg_bref');
            personalStop = null;
            showBookingForm();
        }

        window._driverTarget = nextTarget;
        const avail = TOTAL_SEATS - bookedSeats;
        document.getElementById('seatsLeft').textContent = avail;
        document.getElementById('seatCount').textContent = `${bookedSeats} / ${TOTAL_SEATS}`;
        document.getElementById('manifestList').innerHTML = manifestHTML || `<div class="empty-state">${T[lang].empty_manifest}</div>`;
        document.getElementById('adminUsers').textContent = totalUsers;
        document.getElementById('adminSeats').textContent = bookedSeats;
        const bookBtn = document.getElementById('bookBtn');
        if (bookBtn) bookBtn.disabled = avail <= 0;
        buildSchedule();
    });
}

function initBookingState() {
    if (!myBookingKey) return;
    get(ref(db, 'bookings/' + myBookingKey)).then(snap => {
        if (snap.exists()) {
            const b = snap.val();
            personalStop = STOPS.find(s => s.name === b.pickup) || STOPS[0];
            showBookingConfirmed(b);
        } else {
            myBookingKey = null; myBookingRef = null;
            localStorage.removeItem('sg_bkey'); localStorage.removeItem('sg_bref');
        }
    }).catch(() => {
        myBookingKey = null; localStorage.removeItem('sg_bkey');
    });
}

async function bookSeat() {
    const name = document.getElementById('nameInput').value.trim();
    const seats = parseInt(document.getElementById('seatsInput').value);
    const time = document.getElementById('timeInput').value;
    const pickup = document.getElementById('pickupInput').value;
    if (!name) { showToast('Please enter your name', 'error'); return; }
    if (!time) { showToast('Please select a time', 'error'); return; }

    const bookBtn = document.getElementById('bookBtn');
    bookBtn.classList.add('loading');

    try {
        const key = `${currentUserId}_${Date.now()}`;
        const refCode = generateRef();
        await set(ref(db, 'bookings/' + key), { name, seats, time, pickup, ref: refCode });
        myBookingKey = key;
        myBookingRef = refCode;
        localStorage.setItem('sg_bkey', key);
        localStorage.setItem('sg_bref', refCode);
        personalStop = STOPS.find(s => s.name === pickup) || STOPS[0];

        // Show success animation
        haptic('success');
        const animEl = document.getElementById('bookingSuccessAnim');
        const formEl = document.getElementById('bookingForm');
        formEl.style.display = 'none';
        animEl.classList.add('visible');

        setTimeout(() => {
            animEl.classList.remove('visible');
            showBookingConfirmed({ name, seats, time, pickup, ref: refCode });
            showToast(T[lang].booking_confirmed + '!');
        }, 1500);

        // Request notification permission for shuttle alerts
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    } catch(e) {
        showToast('Booking failed', 'error');
    } finally {
        bookBtn.classList.remove('loading');
    }
}

async function cancelBooking() {
    if (!myBookingKey) return;
    try { await remove(ref(db, 'bookings/' + myBookingKey)); } catch {}
    myBookingKey = null; myBookingRef = null;
    localStorage.removeItem('sg_bkey'); localStorage.removeItem('sg_bref');
    personalStop = null; shuttleAlertShown = false;
    hideShuttleAlert();
    showBookingForm();
    showToast('Booking cancelled');
}

async function clearAllBookings() {
    try { await remove(ref(db, 'bookings')); showToast('All bookings cleared'); } catch { showToast('Failed', 'error'); }
}

async function clearAllChats() {
    try { await remove(ref(db, 'chats')); showToast('All chats cleared'); } catch { showToast('Failed', 'error'); }
}

function showBookingConfirmed(b) {
    document.getElementById('bookingConfirmed').style.display = 'block';
    document.getElementById('bookingForm').style.display = 'none';
    document.getElementById('confirmDetail').innerHTML = `${esc(b.name)} · ${b.seats} pax · ${esc(b.time)}<br>${esc(b.pickup)}`;
    document.getElementById('bookingRefCode').textContent = b.ref || myBookingRef || '—';
}
function showBookingForm() {
    document.getElementById('bookingConfirmed').style.display = 'none';
    document.getElementById('bookingForm').style.display = 'block';
}

// ============================================
// CHAT SYSTEM
// ============================================
let chatAtBottom = true;
let totalChatCount = 0;
let lastReadChatCount = 0;

function updateChatBadge() {
    const badge = document.getElementById('chatBadge');
    if (!badge) return;
    const unread = totalChatCount - lastReadChatCount;
    if (unread > 0 && currentTab !== 'chat') {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

function listenChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.addEventListener('scroll', () => {
        chatAtBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 40;
    });
    onValue(ref(db, 'chats'), (snap) => {
        const data = snap.val();
        chatBox.innerHTML = '';
        if (!data) {
            totalChatCount = 0;
            chatBox.innerHTML = `<div class="chat-empty-state">
                <div class="chat-empty-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                <span>${T[lang].no_messages}</span>
            </div>`;
            updateChatBadge();
            return;
        }
        const msgs = Object.values(data).sort((a,b) => a.timestamp - b.timestamp);

        // Auto-cleanup: keep last 200 messages
        if (currentRole === 'admin' && Object.keys(data).length > 200) {
            const keys = Object.keys(data);
            const sorted = keys.sort((a,b) => (data[a].timestamp || 0) - (data[b].timestamp || 0));
            const toDelete = sorted.slice(0, sorted.length - 200);
            toDelete.forEach(k => remove(ref(db, 'chats/' + k)).catch(() => {}));
        }

        totalChatCount = msgs.length;

        const chatCountEl = document.getElementById('chatCount');
        if (chatCountEl) chatCountEl.textContent = `${msgs.length} msgs`;

        msgs.forEach(msg => {
            const isMine = msg.uid === currentUserId;
            let roleTag = '';
            if (!isMine && msg.role === 'driver') roleTag = '<span class="bubble-role-tag driver">Driver</span>';
            else if (!isMine && msg.role === 'admin') roleTag = '<span class="bubble-role-tag admin">Admin</span>';

            chatBox.innerHTML += `<div class="bubble ${isMine ? 'mine' : 'other'}">
                ${!isMine ? `<div class="bubble-sender">${esc(msg.name)} ${roleTag}</div>` : ''}
                <div>${esc(msg.text)}</div>
                <div class="bubble-time">${esc(msg.time)}</div>
            </div>`;
        });

        if (chatAtBottom) chatBox.scrollTop = chatBox.scrollHeight;

        // Update badge
        if (currentTab === 'chat') lastReadChatCount = totalChatCount;
        updateChatBadge();
    });
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    const now = new Date();
    try {
        await push(ref(db, 'chats'), {
            text: text.substring(0, 500), // limit
            name: currentDisplayName || 'Anonymous',
            uid: currentUserId,
            role: currentRole,
            time: now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
            timestamp: now.getTime()
        });
    } catch { showToast('Failed to send', 'error'); return; }
    input.value = '';
    chatAtBottom = true;
    haptic();
}

// ============================================
// EVENT LISTENERS
// ============================================
function initEventListeners() {
    // Login
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPass').focus(); });

    // Password toggle
    document.getElementById('togglePwBtn').addEventListener('click', togglePasswordVisibility);

    // Bottom nav
    document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Chat
    document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
    document.getElementById('chatSendBtn').addEventListener('click', sendMessage);

    // Settings
    document.getElementById('darkToggle').addEventListener('change', function() { toggleDark(this.checked); });
    document.getElementById('btn-en').addEventListener('click', () => { changeLang('en'); haptic(); });
    document.getElementById('btn-th').addEventListener('click', () => { changeLang('th'); haptic(); });
    document.getElementById('settingName').addEventListener('input', function() { saveNameSetting(this.value); });
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Driver
    document.getElementById('startBtn').addEventListener('click', startSharing);
    document.getElementById('stopBtn').addEventListener('click', stopSharing);

    // Booking
    document.getElementById('bookBtn').addEventListener('click', bookSeat);
    document.getElementById('cancelBookBtn').addEventListener('click', cancelBooking);

    // Admin
    document.getElementById('clearBookingsBtn').addEventListener('click', clearAllBookings);
    document.getElementById('clearChatsBtn').addEventListener('click', clearAllChats);

    // Map buttons
    document.getElementById('mapCenterBtn')?.addEventListener('click', centerMapOnShuttle);
    document.getElementById('mapFitBtn')?.addEventListener('click', fitMapToRoute);

    // GPS banner dismiss
    document.querySelectorAll('.perm-dismiss').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.gps-perm-banner').style.display = 'none');
    });
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initDarkMode();
    initOfflineDetection();
    buildRoute();
    buildSchedule();
    updateCountdown();
    changeLang(lang);

    // Auto-restore session
    const r = localStorage.getItem('sg_role');
    const d = localStorage.getItem('sg_display');
    if (r && d) boot(r, d);
});
