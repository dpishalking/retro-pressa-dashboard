(function () {
  var STORAGE_KEY = "rp_utm_v1";
  var COOKIE_DAYS = 30;
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

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
    UTM_KEYS.forEach(function (key) {
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
    var serialized = JSON.stringify(payload);
    localStorage.setItem(STORAGE_KEY, serialized);
    writeCookie(STORAGE_KEY, serialized, COOKIE_DAYS);
  }

  function mergeUtm(incoming) {
    var current = loadStored() || {};
    var next = {
      utm_source: incoming.utm_source || current.utm_source || "",
      utm_medium: incoming.utm_medium || current.utm_medium || "",
      utm_campaign: incoming.utm_campaign || current.utm_campaign || "",
      utm_content: incoming.utm_content || current.utm_content || "",
      utm_term: incoming.utm_term || current.utm_term || "",
      landing_page: window.location.pathname + window.location.search,
      captured_at: new Date().toISOString()
    };
    if (next.utm_source || next.utm_medium || next.utm_campaign) {
      saveStored(next);
    }
    return next;
  }

  function appendHiddenFields(form, utm) {
    UTM_KEYS.concat(["landing_page"]).forEach(function (key) {
      var value = key === "landing_page" ? utm.landing_page : utm[key];
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

  function wireForms(utm) {
    document.querySelectorAll("form").forEach(function (form) {
      appendHiddenFields(form, utm);
      form.addEventListener("submit", function () {
        appendHiddenFields(form, utm);
      });
    });
  }

  var incoming = parseParams();
  var utm = mergeUtm(incoming);
  wireForms(utm);

  window.RetroPressaUtm = {
    get: function () {
      return loadStored() || utm;
    },
    withUtm: function (url) {
      var stored = loadStored() || utm;
      var target = new URL(url, window.location.origin);
      UTM_KEYS.forEach(function (key) {
        if (stored[key]) target.searchParams.set(key, stored[key]);
      });
      return target.toString();
    }
  };
})();
