(function() {
  // Extension module.
  // Responsible for page opening/closing/stacking.
  var $, ALLOWED_IN_MODAL, ANIMATION_DURATION, FIRST_LOAD, KEY_ESCAPE, PAGES,
    indexOf = [].indexOf;

  $ = jQuery;

  ANIMATION_DURATION = 300;

  KEY_ESCAPE = 27;

  FIRST_LOAD = true;

  PAGES = {
    workspace: {
      id: 'content-workspace',
      min_width: 500,
      width: 1000,
      max_width: 3000,
      path: '/'
    },
    languages: {
      id: 'content-languages',
      min_width: 1080,
      width: 1080,
      max_width: 1400,
      path: '/languages'
    },
    examples: {
      id: 'content-examples',
      min_width: 1000,
      width: 1000,
      max_width: 1400,
      path: '/examples'
    },
    help: {
      id: 'content-help',
      min_width: 1000,
      width: 1000,
      max_width: 1400,
      path: '/help'
    },
    about: {
      id: 'content-about',
      min_width: 600,
      max_width: 600,
      width: 600,
      path: '/about'
    },
    DEFAULT: 'workspace'
  };

  ALLOWED_IN_MODAL = ['help', 'about', 'languages'];

  $.extend(REPLIT, {
    PAGES: PAGES,
    modal: false,
    Modal: function(modal) {
      this.modal = modal;
    },
    LoadExamples: function(file, container, callback) {
      var $examples_container;
      $examples_container = $('#examples-' + container);
      $('.example-group').remove();
      return $.get(file, (contents) => {
        var code, example_element, html, index, name, raw_examples, results, total;
        // Parse examples.
        raw_examples = contents.split(/\*{60,}/);
        index = 0;
        total = Math.floor(raw_examples.length / 2);
        results = [];
        while (index + 1 < raw_examples.length) {
          name = raw_examples[index].replace(/^\s+|\s+$/g, '');
          code = raw_examples[index + 1].trim().replace(/^\s+|\s+$|^b\'|\'$/g, '');
          html = code.replace(/\n|\\n/g, '<br>');
          // Insert an example element and set up its click handler.
          example_element = $(`<div class="example-group example-${total}">
  <div class="example-group-header">${name}</div>
  <code>${html}</code>
</div>`);
          $examples_container.append(example_element);
          example_element.click(function() {
            return callback($($('code', this).html().replace(/<br>/g, '\n')).text());
          });
          results.push(index += 2);
        }
        return results;
      });
    },
    // The pages stacking on the screen.
    page_stack: [],
    // Whether we are currently changing a page (to prevent interference).
    changing_page: false,
    // Open a page by its name.
    OpenPage: function(page_name, callback = $.noop) {
      var current_page, done, index, lang_name, new_title, outerWidth, page;
      if (this.modal && indexOf.call(ALLOWED_IN_MODAL, page_name) < 0) {
        return;
      }
      page = PAGES[page_name];
      current_page = this.page_stack[this.page_stack.length - 1];
      // If the page actually exists and it's not the current one.
      if (!page || current_page === page_name) {
        return this.changing_page = false;
      } else if (this.changing_page) {
        // Interrupt current page switching animation.
        $('.page').stop(true, true);
        this.$container.stop(true, true);
        this.changing_page = false;
        // Retry openning the page.
        return this.OpenPage(page_name);
      } else {
        this.changing_page = true;
        // Calculate and set title.
        lang_name = this.current_lang_name ? this.Languages[this.current_lang_name.toLowerCase()].name : '';
        if (page_name !== 'workspace') {
          new_title = page.$elem.find('.content-title').hide().text();
          REPLIT.changeTitle(new_title);
        } else {
          REPLIT.changeTitle(lang_name);
        }
        // Update widths to those of the new page.
        // We can't take into account mobile sizes, so just assign the whole screen
        // width. That's Ok, since our mobile layout fits the whole width.
        this.min_content_width = this.ISMOBILE ? document.documentElement.clientWidth - 2 * this.RESIZER_WIDTH : page.min_width;
        this.max_content_width = page.max_width;
        // When the workspace is first loaded, don't mess up its default padding.
        if (FIRST_LOAD && page_name === 'workspace') {
          FIRST_LOAD = false;
          page.width = document.documentElement.clientWidth - this.DEFAULT_CONTENT_PADDING;
        }
        this.content_padding = document.documentElement.clientWidth - page.width;
        // Check if the page exists on our stack. If so splice out to be put
        // on top.
        index = this.page_stack.indexOf(page_name);
        if (index > -1) {
          this.page_stack.splice(index, 1);
        }
        // Put the page on top of the stack.
        this.page_stack.push(page_name);
        // Calculate container width.
        outerWidth = page.width;
        // HACK: Workspace doesn't account for resizers for some reason...
        if (page_name !== 'workspace') {
          outerWidth += 2 * this.RESIZER_WIDTH;
        }
        done = () => {
          this.changing_page = false;
          page.$elem.focus();
          return callback();
        };
        if (current_page) {
          // Perform the animation.
          PAGES[current_page].width = $('.page:visible').width();
          // HACK: Workspace doesn't account for resizers for some reason..
          if (current_page === 'workspace') {
            PAGES[current_page].width += 2 * this.RESIZER_WIDTH;
          }
          return PAGES[current_page].$elem.fadeOut(ANIMATION_DURATION, () => {
            return this.$container.animate({
              width: outerWidth
            }, ANIMATION_DURATION, () => {
              // We need to have the box actually displayed (if invisible) so the
              // width calculations inside OnResize() work.
              page.$elem.css({
                width: page.width,
                display: 'block',
                opacity: 0
              });
              this.OnResize();
              return page.$elem.animate({
                opacity: 1
              }, ANIMATION_DURATION, done);
            });
          });
        } else {
          this.$container.css({
            width: outerWidth
          });
          page.$elem.css({
            width: page.width,
            display: 'block'
          });
          this.OnResize();
          return done();
        }
      }
    },
    // Close the top page and opens the page underneath if exists or just animates
    // Back to the original environment width.
    CloseLastPage: function() {
      var closed_page;
      if (this.changing_page) {
        return;
      }
      if (this.page_stack.length <= 1) {
        return Router.navigate('/');
      } else {
        closed_page = this.page_stack[this.page_stack.length - 1];
        Router.navigate(PAGES[this.page_stack[this.page_stack.length - 2]].path);
        return this.page_stack.splice(this.page_stack.indexOf(closed_page), 1);
      }
    }
  });

  $(function() {
    var $body, name, settings;
    // Render language selector.

    // Load Examples
    REPLIT.$this.bind('language_loading', function(_, system_name) {
      var examples;
      examples = REPLIT.Languages[system_name.toLowerCase()].examples;
      if (!REPLIT.ISMOBILE) {
        return REPLIT.LoadExamples(examples.editor, 'editor', function(example) {
          REPLIT.editor.getSession().doc.setValue(example);
          return REPLIT.OpenPage('workspace', function() {
            return REPLIT.editor.focus();
          });
        });
      } else {
        return REPLIT.LoadExamples(examples.console, 'console', function(example) {
          REPLIT.jqconsole.SetPromptText(example);
          return REPLIT.OpenPage('workspace', function() {
            return REPLIT.jqconsole.Focus();
          });
        });
      }
    });
// Since we will be doing lots of animation and syncing, we better cache the
// jQuery elements.
    for (name in PAGES) {
      settings = PAGES[name];
      settings.$elem = $(`#${settings.id}`);
      // If we are on a mobile set all default widths to 0 to invoke resizing
      // to the minimum which is already set to the width;
      if (REPLIT.ISMOBILE && name !== 'workspace') {
        settings.width = 0;
      }
    }
    // Assign events.
    $body = $('body');
    $body.delegate('.page-close', 'click', function() {
      return REPLIT.CloseLastPage();
    });
    // Bind page closing to Escape.
    $(window).keydown(function(e) {
      if (e.which === KEY_ESCAPE && $('.page:visible') !== '#content-workspace') {
        return REPLIT.CloseLastPage();
      }
    });
    // Bind language selector hotkeys.
    return $('#content-languages').keypress(function(e) {
      var letter;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        return;
      }
      letter = String.fromCharCode(e.which).toLowerCase();
      return $('#content-languages li a').each(function() {
        if ($('em', $(this)).text().toLowerCase() === letter) {
          this.click();
          return false;
        }
      });
    });
  });

}).call(this);
