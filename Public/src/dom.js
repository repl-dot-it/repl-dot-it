(function() {
  // Core module.
  // Responsible for DOM initializations, and most interactions.
  var $, ANIMATION_DURATION, CONSOLE_HIDDEN, DEFAULT_CONTENT_PADDING, DEFAULT_SPLIT, DEFAULT_TITLE, EDITOR_HIDDEN, FOOTER_HEIGHT, HEADER_HEIGHT, MAX_PROGRESS_DURATION, MIN_PROGRESS_DURATION, PROGRESS_ANIMATION_DURATION, RESIZER_WIDTH, SNAP_THRESHOLD, TITLE_ANIMATION_DURATION;

  DEFAULT_CONTENT_PADDING = 200;

  FOOTER_HEIGHT = 30;

  HEADER_HEIGHT = 61;

  RESIZER_WIDTH = 8;

  DEFAULT_SPLIT = 0.5;

  CONSOLE_HIDDEN = 1;

  EDITOR_HIDDEN = 0;

  SNAP_THRESHOLD = 0.05;

  ANIMATION_DURATION = 700;

  MIN_PROGRESS_DURATION = 1;

  MAX_PROGRESS_DURATION = 1500;

  PROGRESS_ANIMATION_DURATION = 2000;

  TITLE_ANIMATION_DURATION = 300;

  DEFAULT_TITLE = 'Online Interpreter';

  $ = jQuery;

  // jQuery plugin to disable text selection (x-browser).
  // Used for dragging the resizer.
  $.fn.disableSelection = function() {
    return this.each(function() {
      var $this;
      $this = $(this);
      $this.attr('unselectable', 'on');
      $this.css({
        '-moz-user-select': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none'
      });
      return $this.each(function() {
        return this.onselectstart = function() {
          return false;
        };
      });
    });
  };

  // jQuery plugin to enable text selection (x-browser).
  $.fn.enableSelection = function() {
    return this.each(function() {
      var $this;
      $this = $(this);
      $this.attr('unselectable', '');
      $this.css({
        '-moz-user-select': '',
        '-webkit-user-select': '',
        'user-select': ''
      });
      return $this.each(function() {
        return this.onselectstart = null;
      });
    });
  };

  $.extend(REPLIT, {
    RESIZER_WIDTH: RESIZER_WIDTH,
    CONSOLE_HIDDEN: CONSOLE_HIDDEN,
    EDITOR_HIDDEN: EDITOR_HIDDEN,
    DEFAULT_CONTENT_PADDING: DEFAULT_CONTENT_PADDING,
    split_ratio: REPLIT.ISMOBILE ? EDITOR_HIDDEN : DEFAULT_SPLIT,
    
    // NOTE: These should be synced with PAGES.workspace.width in pager.coffee.
    min_content_width: 500,
    max_content_width: 3000,
    content_padding: DEFAULT_CONTENT_PADDING,
    last_progress_ratio: 0,
    // Initialize the DOM (Runs before JSRPEL's load)
    InitDOM: function() {
      var mobile_timer;
      this.$doc_elem = $('html');
      // The main container holding the pages.
      this.$container = $('#main');
      // The container holding the editor widget and related elements.
      this.$editorContainer = $('#editor');
      // The container holding the console widget and related elements.
      this.$consoleContainer = $('#console');
      // An object holding all the resizer elements.
      this.$resizer = {
        l: $('#resize-left'),
        c: $('#resize-center'),
        r: $('#resize-right')
      };
      // The loading progress bar.
      this.$progress = $('#progress');
      this.$progressFill = $('#progress-fill');
      // An object holding unhider elements.
      this.$unhider = {
        editor: $('#unhide-right'),
        console: $('#unhide-left')
      };
      // Show the run button on hover.
      this.$run = $('#editor-run');
      this.$editorContainer.mouseleave(() => {
        return this.$run.fadeIn('fast');
      });
      this.$editorContainer.mousemove(() => {
        if (this.$run.is(':hidden')) {
          return this.$run.fadeIn('fast');
        }
      });
      this.$editorContainer.keydown(() => {
        return this.$run.fadeOut('fast');
      });
      // Initialaize the column resizers.
      this.InitSideResizers();
      this.InitCenterResizer();
      // Attatch unhiders functionality.
      this.InitUnhider();
      // Fire the onresize method to do initial resizing
      this.OnResize();
      // When the window change size, call the container's resizer.
      mobile_timer = null;
      return $(window).bind('resize', () => {
        var cb;
        if (this.ISMOBILE) {
          mobile_timer = clearTimeout(mobile_timer);
          cb = () => {
            var width;
            width = document.documentElement.clientWidth;
            REPLIT.min_content_width = width - 2 * RESIZER_WIDTH;
            return this.OnResize();
          };
          return mobile_timer = setTimeout((() => {
            return this.OnResize();
          }), 300);
        } else {
          return this.OnResize();
        }
      });
    },
    // Attatches the resizers behaviors.
    InitSideResizers: function() {
      var $body, $elem, _, ref, resizer_lr_release;
      $body = $('body');
      ref = this.$resizer;
      // For all resizers discard right clicks,
      // disable text selection on drag start.
      for (_ in ref) {
        $elem = ref[_];
        $elem.mousedown(function(e) {
          if (e.button !== 0) {
            return e.stopImmediatePropagation();
          } else {
            return $body.disableSelection();
          }
        });
      }
      // On start drag bind the mousemove functionality for right/left resizers.
      this.$resizer.l.mousedown((e) => {
        return $body.bind('mousemove.side_resizer', (e) => {
          // The horizontal mouse position is simply half of the content_padding.
          // Subtract half of the resizer_width for better precision.
          this.content_padding = (e.pageX - (RESIZER_WIDTH / 2)) * 2;
          if (this.content_padding / $body.width() < SNAP_THRESHOLD) {
            this.content_padding = 0;
          }
          return this.OnResize();
        });
      });
      this.$resizer.r.mousedown((e) => {
        return $body.bind('mousemove.side_resizer', (e) => {
          // The mouse is on the right of the container, subtracting the horizontal
          // position from the page width to get the right number.
          this.content_padding = ($body.width() - e.pageX - (RESIZER_WIDTH / 2)) * 2;
          if (this.content_padding / $body.width() < SNAP_THRESHOLD) {
            this.content_padding = 0;
          }
          return this.OnResize();
        });
      });
      // When stopping the drag unbind the mousemove handlers and enable selection.
      resizer_lr_release = function() {
        $body.enableSelection();
        return $body.unbind('mousemove.side_resizer');
      };
      this.$resizer.l.mouseup(resizer_lr_release);
      this.$resizer.r.mouseup(resizer_lr_release);
      return $body.mouseup(resizer_lr_release);
    },
    InitCenterResizer: function() {
      var resizer_c_release;
      // When stopping the drag or when the editor/console snaps into hiding,
      // unbind the mousemove event for the container.
      resizer_c_release = () => {
        this.$container.enableSelection();
        return this.$container.unbind('mousemove.center_resizer');
      };
      // When start drag for the center resizer bind the resize logic.
      this.$resizer.c.mousedown((e) => {
        return this.$container.bind('mousemove.center_resizer', (e) => {
          var left;
          // Get the mouse position relative to the container.
          left = e.pageX - (this.content_padding / 2) + (RESIZER_WIDTH / 2);
          // The ratio of the editor-to-console is the relative mouse position
          // divided by the width of the container.
          this.split_ratio = left / this.$container.width();
          // If the smaller split ratio as small as 0.5% then we must hide the element.
          if (this.split_ratio > CONSOLE_HIDDEN - SNAP_THRESHOLD) {
            this.split_ratio = CONSOLE_HIDDEN;
            // Stop the resize drag.
            resizer_c_release();
          } else if (this.split_ratio < EDITOR_HIDDEN + SNAP_THRESHOLD) {
            this.split_ratio = EDITOR_HIDDEN;
            // Stop the resize drag.
            resizer_c_release();
          }
          // Run the window resize handler to recalculate everything.
          return this.OnResize();
        });
      });
      // Release when:
      this.$resizer.c.mouseup(resizer_c_release);
      this.$container.mouseup(resizer_c_release);
      return this.$container.mouseleave(resizer_c_release);
    },
    InitUnhider: function() {
      var bindUnhiderClick, getUnhider;
      // Show unhider on mouse movement and hide on keyboard interactions.
      getUnhider = () => {
        var ref, side;
        if ((ref = this.split_ratio) !== CONSOLE_HIDDEN && ref !== EDITOR_HIDDEN) {
          return $([]);
        }
        side = this.split_ratio === CONSOLE_HIDDEN ? 'console' : 'editor';
        return this.$unhider[side];
      };
      $('body').mousemove(() => {
        var unhider;
        unhider = getUnhider();
        if (unhider.is(':hidden')) {
          return unhider.fadeIn('fast');
        }
      });
      this.$container.keydown(() => {
        var unhider;
        unhider = getUnhider();
        if (unhider.is(':visible')) {
          return unhider.fadeOut('fast');
        }
      });
      bindUnhiderClick = ($elem, $elemtoShow) => {
        return $elem.click((e) => {
          // Hide the unhider.
          $elem.hide();
          // Set the split ratio to the default split.
          this.split_ratio = DEFAULT_SPLIT;
          // Show the hidden element.
          $elemtoShow.show();
          // Show the center resizer.
          this.$resizer.c.show();
          // Recalculate all sizes.
          return this.OnResize();
        });
      };
      bindUnhiderClick(this.$unhider.editor, this.$editorContainer);
      return bindUnhiderClick(this.$unhider.console, this.$consoleContainer);
    },
    // Updates the progress bar's width and color.
    OnProgress: function(percentage) {
      var duration, fill, ratio;
      ratio = percentage / 100.0;
      // TODO: Find out why this happens.
      if (ratio < this.last_progress_ratio) {
        return;
      }
      duration = (ratio - this.last_progress_ratio) * PROGRESS_ANIMATION_DURATION;
      this.last_progress_ratio = ratio;
      duration = Math.max(duration, MIN_PROGRESS_DURATION);
      duration = Math.min(duration, MAX_PROGRESS_DURATION);
      fill = this.$progressFill;
      return fill.animate({
        width: percentage + '%'
      }, {
        duration: Math.abs(duration),
        easing: 'linear',
        step: function(now, fx) {
          var blue_bottom, blue_top, bottom, green_bottom, green_top, red_bottom, red_top, top;
          ratio = now / 100.0;
          // A hardcoded interpolation equation between:
          //           red       orange     yellow     green
          //    top: #fa6e43 -> #fab543 -> #fad643 -> #88f20d
          // bottom: #f2220c -> #f26c0c -> #f2a40c -> #c7fa44
          red_top = Math.round(ratio < 0.75 ? 250 : 250 + (199 - 250) * ((ratio - 0.75) / 0.25));
          red_bottom = Math.round(ratio < 0.75 ? 242 : 250 + (136 - 250) * ((ratio - 0.75) / 0.25));
          green_top = Math.round(ratio < 0.25 ? 110 + (181 - 110) * (ratio / 0.25) : 181 + (250 - 181) * ((ratio - 0.25) / 0.75));
          green_bottom = Math.round(34 + (242 - 34) * ratio);
          blue_top = 67;
          blue_bottom = 12;
          top = `rgb(${red_top}, ${green_top}, ${blue_top})`;
          bottom = `rgb(${red_bottom}, ${green_bottom}, ${blue_bottom})`;
          if ($.browser.webkit) {
            fill.css({
              'background-image': `url('/images/progress.png'), -webkit-gradient(linear, left top, left bottom, from(${top}), to(${bottom}))`
            });
          } else if ($.browser.mozilla) {
            fill.css({
              'background-image': `url('/images/progress.png'), -moz-linear-gradient(top, ${top}, ${bottom})`
            });
          } else if ($.browser.opera) {
            fill.css({
              'background-image': `url('/images/progress.png'), -o-linear-gradient(top, ${top}, ${bottom})`
            });
          }
          return fill.css({
            'background-image': `url('/images/progress.png'), linear-gradient(top, ${top}, ${bottom})`
          });
        }
      });
    },
    // Resize containers on each window resize, split ratio change or
    // content padding change.
    OnResize: function() {
      var documentHeight, documentWidth, height, innerWidth, width;
      // Calculate container height and width.
      documentWidth = document.documentElement.clientWidth;
      documentHeight = document.documentElement.clientHeight;
      height = documentHeight - HEADER_HEIGHT - FOOTER_HEIGHT;
      width = documentWidth - this.content_padding;
      innerWidth = width - 2 * RESIZER_WIDTH;
      // Clamp width.
      if (innerWidth < this.min_content_width) {
        innerWidth = this.min_content_width;
      } else if (innerWidth > this.max_content_width) {
        innerWidth = this.max_content_width;
      }
      width = innerWidth + 2 * RESIZER_WIDTH;
      // Resize container and current page.
      this.$container.css({
        width: width,
        height: height
      });
      $('.page:visible').css({
        width: innerWidth
      });
      if ($('.page:visible').is('#content-workspace')) {
        return this.ResizeWorkspace(innerWidth, height);
      }
    },
    ResizeWorkspace: function(innerWidth, height) {
      var console_hpadding, console_vpadding, console_width, editor_hpadding, editor_vpadding, editor_width, ref;
      // Calculate editor and console sizes.
      editor_width = Math.floor(this.split_ratio * innerWidth);
      console_width = innerWidth - editor_width;
      if ((ref = this.split_ratio) !== CONSOLE_HIDDEN && ref !== EDITOR_HIDDEN) {
        editor_width -= RESIZER_WIDTH / 2;
        console_width -= RESIZER_WIDTH / 2;
      }
      // Apply the new sizes.
      this.$resizer.c.css({
        left: editor_width
      });
      this.$editorContainer.css({
        width: editor_width,
        height: height
      });
      this.$consoleContainer.css({
        width: console_width,
        height: height
      });
      // Check if console/editor was meant to be hidden.
      if (this.split_ratio === CONSOLE_HIDDEN) {
        this.$consoleContainer.hide();
        this.$resizer.c.hide();
        this.$unhider.console.show();
      } else if (this.split_ratio === EDITOR_HIDDEN) {
        this.$editorContainer.hide();
        this.$resizer.c.hide();
        this.$unhider.editor.show();
      }
      // Calculate paddings if any.
      console_hpadding = this.$console.innerWidth() - this.$console.width();
      console_vpadding = this.$console.innerHeight() - this.$console.height();
      editor_hpadding = this.$editor.innerWidth() - this.$editor.width();
      editor_vpadding = this.$editor.innerHeight() - this.$editor.height();
      // Resize the console/editor widgets.
      this.$editor.css('width', this.$editorContainer.innerWidth() - editor_hpadding);
      this.$editor.css('height', this.$editorContainer.innerHeight() - editor_vpadding);
      if (!this.ISMOBILE) {
        // Call to Ace editor resize.
        return this.editor.resize();
      }
    },
    changeTitle: function(title) {
      var $title, curr_title;
      $title = $('#title');
      curr_title = $title.text().trim();
      if (!title || curr_title === title) {
        return;
      }
      document.title = `repl.it - ${title}`;
      if (curr_title !== '' && curr_title !== DEFAULT_TITLE) {
        return $title.fadeOut(TITLE_ANIMATION_DURATION, function() {
          $title.text(title);
          return $title.fadeIn(TITLE_ANIMATION_DURATION);
        });
      } else {
        return $title.text(title);
      }
    }
  });

  $(function() {
    var check_orientation;
    if (REPLIT.ISIOS) {
      $('html, body').css('overflow', 'hidden');
    }
    REPLIT.$this.bind('language_loading', function(_, system_name) {
      var $about, $engine, $links, lang;
      REPLIT.$progress.animate({
        opacity: 1
      }, 'fast');
      REPLIT.$progressFill.css({
        width: 0
      });
      REPLIT.last_progress_ratio = 0;
      // Update footer links.
      lang = REPLIT.Languages[system_name.toLowerCase()];
      $about = $('#language-about-link');
      $engine = $('#language-engine-link');
      $links = $('#language-engine-link, #language-about-link');
      return $links.animate({
        opacity: 0
      }, 'fast', function() {
        $about.text('about ' + lang.name);
        $about.attr({
          href: lang.about_link
        });
        $engine.text(lang.name + ' engine');
        $engine.attr({
          href: lang.engine_link
        });
        return $links.animate({
          opacity: 1
        }, 'fast');
      });
    });
    REPLIT.$this.bind('language_loaded', function(e, lang_name) {
      REPLIT.OnProgress(100);
      return REPLIT.$progress.animate({
        opacity: 0
      }, 'fast');
    });
    // When the device orientation change adapt the workspace to the new width.
    check_orientation = function() {
      var cb;
      cb = function() {
        var width;
        width = document.documentElement.clientWidth;
        REPLIT.min_content_width = width - 2 * RESIZER_WIDTH;
        REPLIT.OnResize();
        // iPhone scrolls to the left when changing orientation to portrait.
        return $(window).scrollLeft(0);
      };
      // Android takes time to know its own width!
      return setTimeout(cb, 300);
    };
    $(window).bind('orientationchange', check_orientation);
    if (REPLIT.ISMOBILE) {
      check_orientation();
    }
    REPLIT.InitDOM();
    return $('#buttons').tooltip({
      selector: '.button',
      placement: 'bottom'
    });
  });

}).call(this);
