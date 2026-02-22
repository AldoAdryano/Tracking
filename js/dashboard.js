// ============================================================
//  DASHBOARD LOGIC
//  Handles: creating tracking links, listing them, viewing
//  collected locations on a Leaflet map.
// ============================================================

// ── State ────────────────────────────────────────────────────
let allLinks       = [];
let currentLinkId  = null;
let map            = null;
let markers        = [];
let locationsUnsub = null;   // Firestore real-time listener unsubscribe fn

// ── DOM refs ─────────────────────────────────────────────────
const linksTableBody   = document.getElementById('linksTableBody');
const emptyState       = document.getElementById('emptyState');
const statTotalLinks   = document.getElementById('statTotalLinks');
const statTotalHits    = document.getElementById('statTotalHits');
const configWarning    = document.getElementById('configWarning');

// Modals
const createModal      = document.getElementById('createModal');
const viewModal        = document.getElementById('viewModal');
const viewModalTitle   = document.getElementById('viewModalTitle');
const locationList     = document.getElementById('locationList');

// ── Utility: generate a random ID ────────────────────────────
function generateId(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Utility: build the full tracking URL ─────────────────────
function buildTrackUrl(linkId) {
  const base = window.location.href.replace('index.html', '').replace(/\/$/, '');
  return `${base}/track.html?id=${linkId}`;
}

// ── Utility: format timestamp ─────────────────────────────────
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(ts) {
  if (!ts) return '';
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)   return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400)return `${Math.floor(sec/3600)}h ago`;
  return `${Math.floor(sec/86400)}d ago`;
}

// ── Toast notifications ───────────────────────────────────────
function showToast(message, type = 'info') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Copy to clipboard ─────────────────────────────────────────
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-check';
    btn.classList.add('copied');
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => {
      icon.className = 'fas fa-copy';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Link copied!', 'success');
  });
}

// ── Render the links table ────────────────────────────────────
function renderLinks() {
  if (allLinks.length === 0) {
    linksTableBody.innerHTML = '';
    emptyState.style.display = 'block';
    statTotalLinks.textContent = '0';
    statTotalHits.textContent  = '0';
    return;
  }

  emptyState.style.display = 'none';

  const totalHits = allLinks.reduce((sum, l) => sum + (l.hitCount || 0), 0);
  statTotalLinks.textContent = allLinks.length;
  statTotalHits.textContent  = totalHits;

  linksTableBody.innerHTML = allLinks.map(link => {
    const url     = buildTrackUrl(link.id);
    const hits    = link.hitCount || 0;
    const badgeCls = hits === 0 ? 'badge-blue' : hits < 5 ? 'badge-orange' : 'badge-green';

    return `
      <tr>
        <td data-label="Name">
          <span class="link-name">
            <i class="fas fa-link"></i>
            ${escapeHtml(link.name)}
          </span>
        </td>
        <td data-label="Tracking URL" class="link-url-cell">
          <div class="link-url-wrapper">
            <span class="link-url-text" title="${url}">${url}</span>
            <button class="copy-btn" onclick="copyToClipboard('${url}', this)" title="Copy link">
              <i class="fas fa-copy"></i>
            </button>
          </div>
        </td>
        <td data-label="Hits">
          <span class="badge ${badgeCls}">
            <i class="fas fa-map-marker-alt"></i> ${hits} hit${hits !== 1 ? 's' : ''}
          </span>
        </td>
        <td data-label="Created" class="date-text">${formatDate(link.createdAt)}</td>
        <td data-label="Actions">
          <div class="actions-cell">
            <button class="btn btn-sm btn-secondary" onclick="openViewModal('${link.id}', '${escapeHtml(link.name)}')">
              <i class="fas fa-map"></i> View
            </button>
            <button class="btn btn-sm btn-icon" onclick="copyToClipboard('${url}', this)" title="Copy link">
              <i class="fas fa-copy"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteLink('${link.id}', '${escapeHtml(link.name)}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

// ── Load all links from Firestore ─────────────────────────────
function loadLinks() {
  if (!isConfigured()) return;

  db.collection('tracking_links')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      hidePermissionsError();
      allLinks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderLinks();
    }, err => {
      console.error('Firestore error:', err);
      if (err.code === 'permission-denied') {
        showPermissionsError();
      } else {
        showToast('Failed to load links: ' + err.message, 'error');
      }
    });
}

// ── Create a new tracking link ────────────────────────────────
async function createLink() {
  if (!isConfigured()) {
    showToast('Please configure Firebase first. See README.md', 'error');
    return;
  }

  const nameInput = document.getElementById('linkName');
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    showToast('Please enter a link name.', 'error');
    return;
  }

  const createBtn = document.getElementById('createLinkBtn');
  createBtn.disabled = true;
  createBtn.innerHTML = '<span class="spinner"></span> Creating…';

  try {
    const linkId = generateId(10);
    await db.collection('tracking_links').doc(linkId).set({
      name:      name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      hitCount:  0
    });

    closeCreateModal();
    showToast(`Tracking link "${name}" created!`, 'success');
    nameInput.value = '';
  } catch (err) {
    console.error(err);
    closeCreateModal();
    if (err.code === 'permission-denied') {
      showPermissionsError();
    } else {
      showToast('Error creating link: ' + err.message, 'error');
    }
  } finally {
    createBtn.disabled = false;
    createBtn.innerHTML = '<i class="fas fa-plus"></i> Create Link';
  }
}

// ── Delete a tracking link ────────────────────────────────────
async function deleteLink(linkId, name) {
  if (!confirm(`Delete tracking link "${name}"?\nThis will also remove all collected locations.`)) return;

  try {
    // Delete sub-collection locations first
    const locSnap = await db.collection('tracking_links').doc(linkId)
                             .collection('locations').get();
    const batch = db.batch();
    locSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('tracking_links').doc(linkId));
    await batch.commit();
    showToast(`Link "${name}" deleted.`, 'info');
  } catch (err) {
    console.error(err);
    showToast('Error deleting link: ' + err.message, 'error');
  }
}

// ── Open "View Locations" modal ───────────────────────────────
function openViewModal(linkId, linkName) {
  currentLinkId = linkId;
  viewModalTitle.textContent = `Locations — ${linkName}`;
  viewModal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Init map (only once)
  if (!map) {
    map = L.map('map', {
      center: [20, 0],
      zoom: 2,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  // Clear old markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  locationList.innerHTML = '<div class="no-locations"><i class="fas fa-spinner fa-spin"></i>Loading locations…</div>';

  // Unsubscribe previous listener
  if (locationsUnsub) locationsUnsub();

  // Real-time listener for locations
  locationsUnsub = db.collection('tracking_links').doc(linkId)
    .collection('locations')
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      const locs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderLocations(locs);
    }, err => {
      console.error(err);
      locationList.innerHTML = '<div class="no-locations"><i class="fas fa-exclamation-triangle"></i>Error loading locations.</div>';
    });

  // Invalidate map size after modal animation
  setTimeout(() => map && map.invalidateSize(), 350);
}

// ── Render locations list + map markers ──────────────────────
function renderLocations(locs) {
  // Clear markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  if (locs.length === 0) {
    locationList.innerHTML = '<div class="no-locations"><i class="fas fa-map-marker-alt"></i>No locations captured yet.<br><small>Share the tracking link to start collecting.</small></div>';
    map.setView([20, 0], 2);
    return;
  }

  const bounds = [];

  locs.forEach((loc, idx) => {
    if (!loc.lat || !loc.lng) return;

    const num = locs.length - idx; // newest = highest number

    // Custom marker icon
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        background:#58a6ff;color:#0d1117;width:28px;height:28px;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;border:2px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);">
        <span style="transform:rotate(45deg)">${num}</span>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30]
    });

    const marker = L.marker([loc.lat, loc.lng], { icon })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:sans-serif;min-width:180px;">
          <b style="color:#1a1a2e">Hit #${num}</b><br>
          <small style="color:#555">
            📍 ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}<br>
            🎯 Accuracy: ±${Math.round(loc.accuracy || 0)}m<br>
            ${loc.city ? `🏙 ${loc.city}, ${loc.country}<br>` : ''}
            ${loc.ip ? `🌐 IP: ${loc.ip}<br>` : ''}
            🕐 ${formatDate(loc.timestamp)}
          </small>
        </div>
      `);

    markers.push(marker);
    bounds.push([loc.lat, loc.lng]);
  });

  if (bounds.length > 0) {
    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  // Render list
  locationList.innerHTML = locs.map((loc, idx) => {
    const num = locs.length - idx;
    return `
      <div class="location-item" onclick="flyToMarker(${loc.lat}, ${loc.lng})">
        <div class="location-num">${num}</div>
        <div class="location-details">
          <div class="location-coords">
            ${loc.lat ? loc.lat.toFixed(5) : '?'}, ${loc.lng ? loc.lng.toFixed(5) : '?'}
          </div>
          <div class="location-meta">
            ${loc.city ? `${loc.city}, ${loc.country} · ` : ''}
            ${loc.ip ? `IP: ${loc.ip} · ` : ''}
            ±${Math.round(loc.accuracy || 0)}m accuracy
            ${loc.userAgent ? ` · ${getBrowser(loc.userAgent)}` : ''}
          </div>
        </div>
        <div class="location-time">${timeAgo(loc.timestamp)}</div>
      </div>
    `;
  }).join('');
}

// ── Fly to a marker on the map ────────────────────────────────
function flyToMarker(lat, lng) {
  if (!map) return;
  map.flyTo([lat, lng], 14, { duration: 1 });
  // Open popup of nearest marker
  const target = markers.find(m => {
    const ll = m.getLatLng();
    return Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001;
  });
  if (target) target.openPopup();
}

// ── Detect browser from UA ────────────────────────────────────
function getBrowser(ua) {
  if (!ua) return '';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Browser';
}

// ── Modal helpers ─────────────────────────────────────────────
function openCreateModal() {
  if (!isConfigured()) {
    showToast('Firebase not configured. See README.md for setup instructions.', 'error');
    return;
  }
  createModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('linkName').focus(), 200);
}

function closeCreateModal() {
  createModal.classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('linkName').value = '';
}

function closeViewModal() {
  viewModal.classList.remove('active');
  document.body.style.overflow = '';
  if (locationsUnsub) { locationsUnsub(); locationsUnsub = null; }
  currentLinkId = null;
}

// ── Close modals on overlay click ─────────────────────────────
document.getElementById('createModal').addEventListener('click', function(e) {
  if (e.target === this) closeCreateModal();
});
document.getElementById('viewModal').addEventListener('click', function(e) {
  if (e.target === this) closeViewModal();
});

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCreateModal();
    closeViewModal();
  }
});

// ── Enter key in create form ──────────────────────────────────
document.getElementById('linkName').addEventListener('keydown', e => {
  if (e.key === 'Enter') createLink();
});

// ── Permissions error banner ──────────────────────────────────
function showPermissionsError() {
  const el = document.getElementById('permissionsError');
  if (el) el.style.display = 'flex';
  emptyState.style.display = 'none';
  linksTableBody.innerHTML = '';
  statTotalLinks.textContent = '—';
  statTotalHits.textContent  = '—';
}

function hidePermissionsError() {
  const el = document.getElementById('permissionsError');
  if (el) el.style.display = 'none';
}

// ── Check config & show warning ───────────────────────────────
function checkConfig() {
  if (!isConfigured()) {
    configWarning.style.display = 'flex';
    statTotalLinks.textContent = '—';
    statTotalHits.textContent  = '—';
    linksTableBody.innerHTML   = '';
    emptyState.style.display   = 'none';
    // Show demo empty state
    document.getElementById('configEmptyState').style.display = 'block';
  } else {
    configWarning.style.display = 'none';
    document.getElementById('configEmptyState').style.display = 'none';
    loadLinks();
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkConfig();
});
