(function() {
  // Core module.
  // Holds the core application logic and all interactions with JSREPL.
  // Emits events so other modules can hook into.
  var $;

  $ = jQuery;

  $.extend(REPLIT, {
    Init: function() {
      this.jsrepl = new JSREPL({
        input: $.proxy(this.InputCallback, this),
        output: $.proxy(this.OutputCallback, this),
        result: $.proxy(this.ResultCallback, this),
        error: $.proxy(this.ErrorCallback, this),
        progress: $.proxy(this.OnProgress, this),
        timeout: {
          time: 12000,
          callback: () => {
            var a, code;
            if (a = confirm('The program is taking too long to finish. Do you want to stop it?')) {
              code = this.editor.getSession().getValue();
              this.LoadLanguage(this.current_lang.system_name, () => {
                return this.editor.getSession().setValue(code);
              });
            }
            return a;
          }
        }
      });
      // Init console.
      this.jqconsole = this.$consoleContainer.jqconsole('', '   ', '.. ');
      this.$console = this.$consoleContainer.find('.jqconsole');
      // Init editor.
      this.$editor = this.$editorContainer.find('#editor-widget');
      if (!this.ISMOBILE) {
        this.editor = ace.edit('editor-widget');
        this.editor.setTheme('ace/theme/textmate');
        this.editor.renderer.setHScrollBarAlwaysVisible(false);
        this.$run.click(() => {
          // TODO(max99x): Expose state properly from jqconsole.
          if (this.jqconsole.state === 2) { // STATE_PROMPT
            this.jqconsole.AbortPrompt();
            return this.Evaluate(REPLIT.editor.getSession().getValue());
          }
        });
        this.editor.commands.addCommand({
          name: 'run',
          bindKey: {
            win: 'Ctrl-Return',
            mac: 'Command-Return',
            sebder: 'editor'
          },
          exec: () => {
            this.$run.click();
            // Allow async eval to happen then reclaim focus to editor.
            return setTimeout((() => {
              return this.editor.focus();
            }), 0);
          }
        });
        this.editor.commands.addCommand({
          name: 'save',
          bindKey: {
            win: 'Ctrl-S',
            mac: 'Command-S',
            sebder: 'editor'
          },
          exec: () => {
            return $('#button-save').click();
          }
        });
      }
      this.current_lang = null;
      this.current_lang_name = null;
      return this.inited = true;
    },
    // Load a given language by name.
    LoadLanguage: function(lang_name, callback = $.noop) {
      var EditSession, UndoManager, ace_mode, ace_mode_ajax, close, i, index, len, open, ref, session, textMode;
      this.$this.trigger('language_loading', [lang_name]);
      this.current_lang = this.jsrepl.getLangConfig(lang_name.toLowerCase());
      // Hold the name for saving and such.
      this.current_lang.system_name = lang_name;
      //Load Ace mode.
      if (!this.ISMOBILE) {
        EditSession = require("ace/edit_session").EditSession;
        UndoManager = require("ace/undomanager").UndoManager;
        session = new EditSession('');
        session.setUndoManager(new UndoManager());
        ace_mode = this.Languages[lang_name.toLowerCase()].ace_mode;
        if (ace_mode != null) {
          // jQuery deferred object for getting ace mode.
          ace_mode_ajax = $.getScript(ace_mode.script, () => {
            var mode;
            mode = require(ace_mode.module).Mode;
            session.setMode(new mode());
            session.setUseWrapMode(true);
            return this.editor.setSession(session);
          });
        } else {
          // No ace mode found create a resolved deferred.
          ace_mode_ajax = jQuery.Deferred().resolve();
          textMode = require("ace/mode/text").Mode;
          session.setMode(new textMode());
          this.editor.setSession(session);
        }
      }
      // Empty out the history and prompt.
      this.jqconsole.Reset();
      ref = this.current_lang.matchings;
      // Register character matchings in jqconsole for the current language.
      for (index = i = 0, len = ref.length; i < len; index = ++i) {
        [open, close] = ref[index];
        this.jqconsole.RegisterMatching(open, close, 'matching-' + index);
      }
      // Register shortcuts.
      this.jqconsole.RegisterShortcut('Z', () => {
        this.jqconsole.AbortPrompt();
        return this.StartPrompt();
      });
      this.jqconsole.RegisterShortcut('L', () => {
        return this.OpenPage('languages');
      });
      this.jqconsole.RegisterShortcut('G', () => {
        return this.OpenPage('examples');
      });
      this.jqconsole.RegisterShortcut('H', () => {
        return this.OpenPage('help');
      });
      this.jqconsole.RegisterShortcut('S', () => {
        return $('#button-save').click();
      });
      this.jqconsole.RegisterShortcut('A', () => {
        return this.jqconsole.MoveToStart();
      });
      this.jqconsole.RegisterShortcut('E', () => {
        return this.jqconsole.MoveToEnd();
      });
      this.jqconsole.RegisterShortcut('K', () => {
        return this.jqconsole.Clear();
      });
      // Load the language engine from jsREPL.
      return this.jsrepl.loadLanguage(lang_name.toLowerCase(), () => {
        // Continue only when the ace mode retrieval is done.
        return $.when(ace_mode_ajax).then(() => {
          this.StartPrompt();
          this.$this.trigger('language_loaded', [lang_name]);
          this.jqconsole.Write(this.Languages[lang_name.toLowerCase()].header + '\n');
          return callback();
        });
      });
    },
    // Receives the result of a command evaluation.
    //   @arg result: The user-readable string form of the result of an evaluation.
    ResultCallback: function(result) {
      if (result) {
        if (result[-1] !== '\n') {
          result = result + '\n';
        }
        this.jqconsole.Write('=> ' + result, 'result');
      }
      this.StartPrompt();
      return this.$this.trigger('result', [result]);
    },
    // Receives an error message resulting from a command evaluation.
    //   @arg error: A message describing the error.
    ErrorCallback: function(error) {
      if (typeof error === 'object') {
        error = error.message;
      }
      if (error[-1] !== '\n') {
        error = error + '\n';
      }
      this.jqconsole.Write(String(error), 'error');
      this.StartPrompt();
      return this.$this.trigger('error', [error]);
    },
    // Receives any output from a language engine. Acts as a low-level output
    // stream or port.
    //   @arg output: The string to output. May contain control characters.
    //   @arg cls: An optional class for styling the output.
    OutputCallback: function(output, cls) {
      if (output) {
        this.jqconsole.Write(output, cls);
        this.$this.trigger('output', [output]);
        return void 0;
      }
    },
    // Receives a request for a string input from a language engine. Passes back
    // the user's response asynchronously.
    //   @arg callback: The function called with the string containing the user's
    //     response.
    InputCallback: function(callback) {
      this.jqconsole.Input((result) => {
        var e;
        try {
          callback(result);
          return this.$this.trigger('input', [result]);
        } catch (error1) {
          e = error1;
          return this.ErrorCallback(e);
        }
      });
      this.$this.trigger('input_request', [callback]);
      return void 0;
    },
    Evaluate: function(command) {
      if (command) {
        this.jsrepl.eval(command);
        return this.$this.trigger('eval', [command]);
      } else {
        return this.StartPrompt();
      }
    },
    // Shows a command prompt in the console and waits for input.
    StartPrompt: function() {
      return this.jqconsole.Prompt(true, $.proxy(this.Evaluate, this), this.jsrepl.checkLineEnd, true);
    }
  });

  $(function() {
    return REPLIT.Init();
  });

}).call(this);
