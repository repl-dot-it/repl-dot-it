(function() {
  // Extension module.
  // Encapsulates for all session/state loading saving logic.
  // TODO(amasad): Graceful localStorage degradation to cookies.
  var $, SHARE_TEMPLATE, WAIT_BETWEEN_SAVES, reset_state;

  $ = jQuery;

  WAIT_BETWEEN_SAVES = 2000;

  SHARE_TEMPLATE = {
    twitter: function() {
      var related, text, uri, url;
      text = 'Check out my REPL session - ';
      related = 'replit';
      url = window.location.href;
      uri = $.param({text, url, related});
      return `<a href="https://twitter.com/share?${uri}" target="_blank"></a>`;
    },
    facebook: function() {
      return `<a href="javascript:var d=document,f='http://www.facebook.com/share',l=d.location,e=encodeURIComponent,p='.php?src=bm&v=4&i=1315186262&u='+e(l.href)+'&t='+e(d.title);1;try{if (!/^(.*\.)?facebook\.[^.]*$/.test(l.host))throw(0);share_internal_bookmarklet(p)}catch(z) {a=function() {if (!window.open(f+'r'+p,'sharer','toolbar=0,status=0,resizable=1,width=626,height=436'))l.href=f+p};if (/Firefox/.test(navigator.userAgent))setTimeout(a,0);else{a()}}void(0)"></a>`;
    },
    // Unofficial!
    gplus: function() {
      var text;
      text = 'Check out my REPL session - ' + window.location.href;
      text = encodeURI(text);
      return `<a href="https://m.google.com/app/plus/x/bggo8s9j8yqo/?v=compose&content=${text}&login=1&pli=1&hideloc=1" target="_blank"></a>`;
    }
  };

  $.extend(REPLIT, {
    session: {
      eval_history: []
    }
  });

  // Resets application to its initial state (handler for language_loaded event).
  reset_state = function(e, lang_name) {
    localStorage.setItem('lang_name', lang_name);
    $('#replay-button').hide();
    this.session = {};
    this.session.eval_history = [];
    return Router.change_base('/');
  };

  $(function() {
    var bindSaveButton, lang_name, saveSession, unbindSaveButton;
    // If there exists a REPLIT_DATA variable, then we are in a saved session.
    if (typeof REPLIT_DATA !== "undefined" && REPLIT_DATA !== null) {
      // Load the language specified by the incoming session data.
      REPLIT.current_lang_name = REPLIT_DATA.language;
      REPLIT.LoadLanguage(REPLIT_DATA.language, function() {
        if (!REPLIT.ISMOBILE) {
          // Set the editor text.
          REPLIT.editor.getSession().setValue(REPLIT_DATA.editor_text);
        }
        // Get the session data.
        REPLIT.session.id = REPLIT_DATA.session_id;
        REPLIT.session.rid = REPLIT_DATA.revision_id;
        REPLIT.session.saved_eval_history = REPLIT_DATA.eval_history;
        // Show the replay button.
        $('#replay-button').show();
        // Delete the incoming session data from the server since we have
        // extracted everything we neeed.
        delete window['REPLIT_DATA'];
        // On each language load after this one reset the state.
        return REPLIT.$this.bind('language_loaded', reset_state);
      });
    } else if (!REPLIT.url_language) {
      // We are not in a saved session.
      // Safely bind the reset state function.
      REPLIT.$this.bind('language_loaded', reset_state);
      lang_name = localStorage.getItem('lang_name');
      if (lang_name != null) {
        REPLIT.loading_saved_lang = true;
        REPLIT.current_lang_name = lang_name;
        // We have a saved local settings for language to load. Delay this until
        // the Analytics modules has set its hook so it can catch language loading.
        $(function() {
          return REPLIT.LoadLanguage(lang_name);
        });
      } else {
        // This is the first visit; show language overlay.
        $('#languages-back').bind('click.language_modal', function(e) {
          e.stopImmediatePropagation();
          return false;
        });
        $('#content-languages .language-group li').bind('click.language_modal', function(e) {
          return REPLIT.Modal(false);
        });
        REPLIT.$this.bind('language_loaded.language_modal', function(e) {
          return $('#languages-back').unbind('click.language_modal');
        });
        Router.navigate('/languages');
        REPLIT.Modal(true);
      }
    }
    // Click handler for the replay button.
    $('#replay-button').click(function(e) {
      var handler, history, index, input_lock, input_unlock, locked, locked_queue;
      // Get the history comming from the server.
      history = REPLIT.session.saved_eval_history;
      locked = false;
      locked_queue = [];
      index = -1;
      // Executes a command from history and waits for the result to continue
      // with the next command.
      handler = function() {
        var _multiline;
        if (!locked) {
          index++;
          if (history[index] != null) {
            // Set the prompt text to the command in question.
            REPLIT.jqconsole.SetPromptText(history[index]);
            // Remove multiline handler from jqconsole to ensure it doesn't
            // continue to the next line.
            _multiline = REPLIT.jqconsole.multiline_callback;
            REPLIT.jqconsole.multiline_callback = void 0;
            // Simulate an enter button on jqconsole.
            REPLIT.jqconsole._HandleEnter();
            // Reassign the multiline handler.
            return REPLIT.jqconsole.multiline_callback = _multiline;
          } else {
            // There is no more commands; unbind the handler.
            REPLIT.$this.unbind('result', handler);
            REPLIT.$this.unbind('error', handler);
            // We are done with the eval history from the server; delete it.
            return delete REPLIT.session['saved_eval_history'];
          }
        } else {
          return locked_queue.push(handler);
        }
      };
      input_lock = function() {
        return locked = true;
      };
      input_unlock = function() {
        var fn;
        locked = false;
        fn = locked_queue.shift();
        if (fn != null) {
          return setTimeout(fn, 100);
        }
      };
      REPLIT.$this.bind('result', handler);
      REPLIT.$this.bind('error', handler);
      REPLIT.$this.bind('input', input_unlock);
      REPLIT.$this.bind('input_request', input_lock);
      // Initiate the first handler to start executing history commands.
      handler();
      // This button can only be clicked once. Now hide it.
      return $(this).hide();
    });
    saveSession = function(e) {
      var post_data;
      // Can't save if we haven't selected a language yet.
      if (REPLIT.current_lang == null) {
        return;
      }
      // Get the post data to save.
      post_data = {
        language: REPLIT.current_lang.system_name,
        editor_text: !REPLIT.ISMOBILE ? REPLIT.editor.getSession().getValue() : void 0,
        eval_history: JSON.stringify(REPLIT.session.eval_history),
        console_dump: REPLIT.jqconsole.Dump()
      };
      if (REPLIT.session.id != null) {
        
        // If we are already REPLing on a saved session, get its id.
        post_data.id = REPLIT.session.id;
      }
      // Do the actual save request.
      return $.post('/save', post_data, function(data) {
        var $savebox, revision_id, session_id;
        ({session_id, revision_id} = data);
        $savebox = $('#save-box');
        // Update URL.
        if (revision_id > 0) {
          Router.change_base(`/${session_id}/${revision_id}`);
        } else {
          Router.change_base(`/${session_id}`);
        }
        // Update IDs.
        REPLIT.session.id = session_id;
        REPLIT.session.rid = revision_id;
        // Render social share links.
        $savebox.find('li.twitter a').replaceWith(SHARE_TEMPLATE.twitter());
        $savebox.find('li.facebook a').replaceWith(SHARE_TEMPLATE.facebook());
        $savebox.find('li.gplus a').replaceWith(SHARE_TEMPLATE.gplus());
        $savebox.find('input').val(window.location.href);
        $savebox.find('.downloads a.editor').attr('href', `/download/editor/${session_id}/${revision_id}/`);
        $savebox.find('.downloads a.repl').attr('href', `/download/repl/${session_id}/${revision_id}/`);
        $savebox.slideDown();
        $savebox.click(function(e) {
          return e.stopPropagation();
        });
        $('body').bind('click.closesave', function() {
          $savebox.slideUp();
          return $('body').unbind('click.closesave');
        });
        // Disable share button for a little while.
        unbindSaveButton();
        return setTimeout(bindSaveButton, WAIT_BETWEEN_SAVES);
      });
    };
    bindSaveButton = function() {
      return $('#button-save').click(saveSession);
    };
    unbindSaveButton = function() {
      return $('#button-save').unbind('click');
    };
    bindSaveButton();
    $('#save-box input').click(function() {
      return $(this).select();
    });
    // When any command is evaled, save it in the eval_history array of the session
    // object, in order to send it to the server on save.
    return REPLIT.$this.bind('eval', function(e, command) {
      return REPLIT.session.eval_history.push(command);
    });
  });

}).call(this);
