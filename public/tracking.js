/**
 * Kanzlei Brands Attributions-Tracking-Snippet. Einbindung auf den externen
 * Landingpages (nicht in diesem Portal), z.B.:
 *   <script src="https://portal.kanzlei-brands.de/tracking.js" data-org="ORG_ID"></script>
 * Erfasst UTM-Parameter + Click-IDs beim Landing (first-party, da das Skript
 * auf der Besucher-Domain selbst läuft), merkt sich eine anonyme Besucher-ID
 * über Sessions hinweg und meldet jeden Seitenaufruf an /api/tracking/collect.
 * Beim Formular-Absenden ruft die Landingpage window.KBTrack.identify(email)
 * auf, um den bisherigen anonymen Verlauf rückwirkend mit der E-Mail zu
 * verknüpfen ("Pre-Journey"). Bewusst ohne Consent-Gate (Vorgabe Geschäftsführung).
 */
(function () {
  var script = document.currentScript;
  var orgId = script && script.getAttribute("data-org");
  var endpoint = (script ? script.src.replace(/\/tracking\.js.*$/, "") : "") + "/api/tracking/collect";
  if (!orgId) return;

  var STORAGE_KEY = "kb_avid";
  var LAST_TOUCH_KEY = "kb_last_touch";
  var CLICK_ID_PARAMS = { fbclid: "FBCLID", gclid: "GCLID", gbraid: "GBRAID", wbraid: "WBRAID", msclkid: "MSCLKID", li_fat_id: "LI_FAT_ID" };
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getVisitorId() {
    try {
      var existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      var id = uuid();
      localStorage.setItem(STORAGE_KEY, id);
      document.cookie = STORAGE_KEY + "=" + id + ";max-age=" + 60 * 60 * 24 * 90 + ";path=/;SameSite=Lax";
      return id;
    } catch (e) {
      return uuid();
    }
  }

  function readTouchFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var touch = {};
    var hasAny = false;
    for (var i = 0; i < UTM_KEYS.length; i++) {
      var value = params.get(UTM_KEYS[i]);
      if (value) {
        touch[UTM_KEYS[i]] = value;
        hasAny = true;
      }
    }
    for (var param in CLICK_ID_PARAMS) {
      var clickValue = params.get(param);
      if (clickValue) {
        touch.clickIdType = CLICK_ID_PARAMS[param];
        touch.clickIdValue = clickValue;
        hasAny = true;
      }
    }
    return hasAny ? touch : null;
  }

  function getLastTouch() {
    var fresh = readTouchFromUrl();
    if (fresh) {
      try {
        localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(fresh));
      } catch (e) {}
      return fresh;
    }
    try {
      var stored = localStorage.getItem(LAST_TOUCH_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  function send(payload) {
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (e) {}
  }

  var visitorId = getVisitorId();
  var lastTouch = getLastTouch();

  send({
    orgId: orgId,
    event: "pageview",
    anonymousVisitorId: visitorId,
    utmSource: lastTouch.utm_source || null,
    utmMedium: lastTouch.utm_medium || null,
    utmCampaign: lastTouch.utm_campaign || null,
    utmContent: lastTouch.utm_content || null,
    utmTerm: lastTouch.utm_term || null,
    clickIdType: lastTouch.clickIdType || null,
    clickIdValue: lastTouch.clickIdValue || null,
    landingUrl: window.location.href,
    referrerUrl: document.referrer || null,
  });

  window.KBTrack = {
    identify: function (email, name) {
      if (!email) return;
      send({ orgId: orgId, event: "identify", anonymousVisitorId: visitorId, email: email, name: name || null });
    },
  };
})();
