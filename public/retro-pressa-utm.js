(function () {
  var STORAGE_KEY = "rp_utm_v1";
  var COOKIE_DAYS = 30;
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var CLICK_KEYS = ["gclid", "fbclid"];
  var ATTRIBUTION_KEYS = UTM_KEYS.concat(CLICK_KEYS);
  var FIELD_KEYS = ATTRIBUTION_KEYS.concat(["landing_page"]);

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function writeCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; expires=" + expires + "; SameSite=Lax";
  }

  function parseParams(search) {
    var params = new URLSearchParams(search || window.location.search);
    var result = {};
    ATTRIBUTION_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value) result[key] = value.trim();
    });
    return result;
  }

  function loadStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || readCookie(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveStored(payload) {
    try {
      var serialized = JSON.stringify(payload);
      localStorage.setItem(STORAGE_KEY, serialized);
      writeCookie(STORAGE_KEY, serialized, COOKIE_DAYS);
    } catch (error) {
      /* storage may be blocked (private mode) — attribution still works in-memory */
    }
  }

  // URL wins; otherwise fall back to previously stored values (first-touch persistence).
  function mergeUtm(incoming) {
    var current = loadStored() || {};
    var next = {
      utm_source: incoming.utm_source || current.utm_source || "",
      utm_medium: incoming.utm_medium || current.utm_medium || "",
      utm_campaign: incoming.utm_campaign || current.utm_campaign || "",
      utm_content: incoming.utm_content || current.utm_content || "",
      utm_term: incoming.utm_term || current.utm_term || "",
      gclid: incoming.gclid || current.gclid || "",
      fbclid: incoming.fbclid || current.fbclid || "",
      landing_page: current.landing_page || (window.location.pathname + window.location.search),
      captured_at: current.captured_at || new Date().toISOString()
    };
    var hasSignal = next.utm_source || next.utm_medium || next.utm_campaign || next.gclid || next.fbclid;
    if (hasSignal) {
      saveStored(next);
    }
    return next;
  }

  function valueForKey(utm, key) {
    return key === "landing_page" ? utm.landing_page : utm[key];
  }

  // Fill hidden attribution fields; only touches inputs whose name is in FIELD_KEYS,
  // never other form fields. Creates a hidden input if the form has no such field yet.
  function fillFields(form, utm) {
    FIELD_KEYS.forEach(function (key) {
      var value = valueForKey(utm, key);
      if (!value) return;
      var input = form.querySelector('input[name="' + key + '"]');
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        form.appendChild(input);
      }
      input.value = value;
    });
  }

  var wiredForms = typeof WeakSet === "function" ? new WeakSet() : null;

  function wireForm(form, utm) {
    if (!form || (wiredForms && wiredForms.has(form))) return;
    if (wiredForms) wiredForms.add(form);
    fillFields(form, utm);
    form.addEventListener("submit", function () {
      fillFields(form, utm);
    });
  }

  function wireAllForms(utm, root) {
    var scope = root || document;
    if (scope.querySelectorAll) {
      scope.querySelectorAll("form").forEach(function (form) {
        wireForm(form, utm);
      });
    }
    if (scope.tagName === "FORM") {
      wireForm(scope, utm);
    }
  }

  // Tilda popups (and other modals) inject their forms into the DOM after load.
  function observeForms(utm) {
    if (typeof MutationObserver !== "function") return;
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j += 1) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.tagName === "FORM") {
            wireForm(node, utm);
          } else if (node.querySelectorAll) {
            wireAllForms(utm, node);
          }
        }
      }
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  }

  function start() {
    var incoming = parseParams();
    var utm = mergeUtm(incoming);
    wireAllForms(utm);
    observeForms(utm);

    window.RetroPressaUtm = {
      get: function () {
        return loadStored() || utm;
      },
      withUtm: function (url) {
        var stored = loadStored() || utm;
        var target = new URL(url, window.location.origin);
        UTM_KEYS.concat(CLICK_KEYS).forEach(function (key) {
          if (stored[key]) target.searchParams.set(key, stored[key]);
        });
        return target.toString();
      }
    };

    // Manual check helper: window.retroAttributionDebug()
    window.retroAttributionDebug = function () {
      var stored = loadStored();
      var current = stored || utm;
      var forms = document.querySelectorAll("form");
      var snapshot = {
        url: parseParams(),
        resolved: current,
        stored: stored,
        formsOnPage: forms.length
      };
      if (typeof console !== "undefined") {
        console.log("[RetroPressa attribution]");
        if (console.table) {
          console.table(current);
        } else {
          console.log(current);
        }
        console.log("Forms on page:", forms.length);
      }
      return snapshot;
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
