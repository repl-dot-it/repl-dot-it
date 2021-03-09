(function() {
  // Adapted from jQuery migrate.
  var ISMOBILE, browser, chromeVersion, matched, safariVersion, uaMatch;

  uaMatch = function(ua) {
    var match;
    ua = ua.toLowerCase();
    match = /(chrome)[ \/]([\w.]+)/.exec(ua) || /(webkit)[ \/]([\w.]+)/.exec(ua) || /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) || /(msie) ([\w.]+)/.exec(ua) || ua.indexOf('compatible') < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) || [];
    return {
      browser: match[1] || '',
      version: match[2] || '0'
    };
  };

  matched = uaMatch(navigator.userAgent);

  browser = {};

  if (matched.browser) {
    browser[matched.browser] = true;
    browser.version = matched.version;
    if (browser.chrome) {
      browser.webkit = true;
    } else if (browser.webkit) {
      browser.safari = true;
    }
    jQuery.browser = browser;
  }

  ISMOBILE = Boolean(navigator.userAgent.match(/iPhone|iPad|iPod|Android/i));

  if (!ISMOBILE) {
    chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/i);
    safariVersion = navigator.userAgent.match(/Version\/(\d+)/i);
    if ((browser.msie && browser.version < 10.0) || (browser.mozilla && browser.version < 4) || (browser.opera && browser.version < 11.51) || (browser.safari && chromeVersion && chromeVersion[1] < 13) || (browser.safari && safariVersion && safariVersion[1] < 5)) {
      $(function() {
        $('#content-fallback').show();
        return $('#fallback-ignore').click(function() {
          return $('#content-fallback').hide();
        });
      });
    }
  }

  $.extend(REPLIT, {
    ISMOBILE: ISMOBILE,
    ISIOS: Boolean(navigator.userAgent.match(/iPhone|iPad|iPod/i))
  });

}).call(this);
