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
 *
 * Zusätzlich zum reinen Erfassen:
 * - Hängt die aktuellen UTM-Werte an jeden Calendly-Link/-Embed auf der Seite
 *   an, BEVOR der Besucher klickt. Ohne das kommen in Calendlys eigenem
 *   Webhook (payload.tracking.utm_*, siehe /api/webhooks/calendly) leere
 *   Felder an, da Calendly UTMs nur aus der eigenen URL liest, nicht von der
 *   Eltern-Seite erbt.
 * - Füllt versteckte Formularfelder automatisch, deren value-Attribut einen
 *   unserer Schlüssel trägt (z.B. <input type="hidden" value="utm_source">),
 *   damit auch Formulare, deren Backend wir nicht kontrollieren, die Werte
 *   mitbekommen.
 * - Liest zusätzlich Metas eigene _fbp/_fbc-Cookies (falls der Meta-Pixel
 *   ebenfalls installiert ist) für bessere CAPI-Matchqualität als der rohe
 *   fbclid allein.
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

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
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

  function hostnameOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return null;
    }
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
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Kein UTM in der URL und noch nie eine Attribution gespeichert - erster
    // bekannter Touch dieses Besuchers. Referrer als Quelle nutzen, damit die
    // Candidate Journey nicht jeden unbezahlten Erstkontakt nur als "Direkt"
    // zeigt (resolvePlatform() ordnet bekannte Such-/Social-Hostnamen dann
    // "Organisch" statt einer bezahlten Plattform zu). Wird einmalig
    // gespeichert, damit spätere interne Seitenwechsel nicht den eigenen
    // Referrer fälschlich als neuen Touch übernehmen.
    var referrerFallback = {
      utm_source: document.referrer ? hostnameOf(document.referrer) || "direct" : "direct",
      utm_medium: document.referrer ? "referrer" : "none",
    };
    try {
      localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(referrerFallback));
    } catch (e) {}
    return referrerFallback;
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
    fbp: getCookie("_fbp"),
    fbc: getCookie("_fbc"),
    landingUrl: window.location.href,
    referrerUrl: document.referrer || null,
  });

  window.KBTrack = {
    identify: function (email, name) {
      if (!email) return;
      send({ orgId: orgId, event: "identify", anonymousVisitorId: visitorId, email: email, name: name || null });
    },
  };

  // ---------------------------------------------------------------------
  // Calendly-UTM-Passthrough + versteckte Formularfelder
  // ---------------------------------------------------------------------

  var CALENDLY_MARKER = "calendly.com";

  function appendUtmToUrl(rawUrl) {
    try {
      var url = new URL(rawUrl, window.location.href);
      for (var i = 0; i < UTM_KEYS.length; i++) {
        var key = UTM_KEYS[i];
        var value = lastTouch[key];
        if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
      }
      return url.toString();
    } catch (e) {
      return rawUrl;
    }
  }

  function tagCalendlyElements() {
    var links = document.querySelectorAll('a[href*="' + CALENDLY_MARKER + '"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      if (href) links[i].setAttribute("href", appendUtmToUrl(href));
    }
    var iframes = document.querySelectorAll('iframe[src*="' + CALENDLY_MARKER + '"]');
    for (var j = 0; j < iframes.length; j++) {
      var src = iframes[j].getAttribute("src");
      if (src) iframes[j].setAttribute("src", appendUtmToUrl(src));
    }
    // Offizielles Calendly-Inline-Embed nutzt data-url statt src/href.
    var dataUrlEls = document.querySelectorAll('[data-url*="' + CALENDLY_MARKER + '"]');
    for (var k = 0; k < dataUrlEls.length; k++) {
      var dataUrl = dataUrlEls[k].getAttribute("data-url");
      if (dataUrl) dataUrlEls[k].setAttribute("data-url", appendUtmToUrl(dataUrl));
    }
  }

  var HIDDEN_FIELD_VALUES = {
    utm_source: lastTouch.utm_source || null,
    utm_medium: lastTouch.utm_medium || null,
    utm_campaign: lastTouch.utm_campaign || null,
    utm_content: lastTouch.utm_content || null,
    utm_term: lastTouch.utm_term || null,
    anonymousVisitorId: visitorId,
  };

  function fillHiddenFields() {
    var hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    for (var i = 0; i < hiddenInputs.length; i++) {
      var el = hiddenInputs[i];
      var marker = el.value;
      if (Object.prototype.hasOwnProperty.call(HIDDEN_FIELD_VALUES, marker)) {
        var real = HIDDEN_FIELD_VALUES[marker];
        if (real) el.value = real;
      }
    }
  }

  function syncOutboundTracking() {
    tagCalendlyElements();
    fillHiddenFields();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncOutboundTracking);
  } else {
    syncOutboundTracking();
  }
  // Calendly-Embeds und manche Formular-Builder rendern ihr Markup erst nach
  // eigenem asynchronem Nachladen - einmaliges Prüfen beim Start reicht dann
  // nicht, ein MutationObserver fängt das nachträglich eingefügte DOM ab.
  try {
    new MutationObserver(syncOutboundTracking).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  document.addEventListener("submit", fillHiddenFields, true);
})();
