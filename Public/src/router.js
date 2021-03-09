(function() {
  var loc, replace_base;

  $(function() {
    var first_load;
    page('/', function() {
      return REPLIT.OpenPage('workspace');
    });
    page('/examples', function(context, next) {
      if ((REPLIT.current_lang != null) && REPLIT.jqconsole.GetState() === 'prompt') {
        $('#examples-editor').toggle(REPLIT.split_ratio !== REPLIT.EDITOR_HIDDEN);
        $('#examples-console').toggle(REPLIT.split_ratio !== REPLIT.CONSOLE_HIDDEN);
        return REPLIT.OpenPage('examples');
      } else {
        return Router.navigate('/');
      }
    });
    page('/about', function() {
      return REPLIT.OpenPage('about');
    });
    page('/help', function() {
      return REPLIT.OpenPage('help');
    });
    page('/languages', function() {
      return REPLIT.OpenPage('languages');
    });
    page('/languages/:lang', function(context) {
      var lang, old_lang;
      // So we don't try to load from localStorage.
      REPLIT.url_language = true;
      if (lang = context.params.lang) {
        old_lang = REPLIT.current_lang_name;
        REPLIT.current_lang_name = lang;
        REPLIT.OpenPage('workspace');
        if (old_lang !== lang) {
          return REPLIT.LoadLanguage(lang);
        }
      }
    });
    first_load = true;
    page('/:name/:num?/:page_name?', function(context) {
      var base, name, num, page_name;
      if (!first_load) {
        // It's hard to reproduce old session state. Let's just reload the page.
        return window.location.reload();
      } else {
        ({name, num, page_name} = context.params);
        if (num && !num.match(/\d+/)) {
          page_name = num;
          num = null;
        }
        first_load = false;
        base = `/${name}`;
        if (num) {
          base += `/${num}`;
        }
        Router.change_base(base, false);
        if (page_name) {
          return page(`/${page_name}`);
        } else {
          return REPLIT.OpenPage('workspace');
        }
      }
    });
    return page();
  });

  loc = window.location;

  replace_base = function(href, old_base, new_base) {
    href = href.replace(old_base, '');
    if (href[0] === '/') {
      href = href.substr(1);
    }
    href = `${new_base}/${href}`;
    // Remove //, trailing slashes etc.
    return '/' + href.split('/').filter(function(p) {
      return !!p;
    }).join('/');
  };

  window.Router = {
    base: '/',
    navigate: function(path, context) {
      if (loc.pathname !== path) {
        return page(path);
      }
    },
    change_base: function(path, navigate = true) {
      var old_base;
      if (path === this.base) {
        return;
      }
      old_base = this.base;
      this.base = path;
      $('a').each(function() {
        var href;
        href = $(this).attr('href');
        // Internal link.
        if (href[0] === '/') {
          return $(this).attr('href', replace_base(href, old_base, path));
        }
      });
      page.base(this.base);
      if (navigate) {
        return page(this.base);
      }
    }
  };

}).call(this);
