'use strict';

var pug = require('../');
var assert = require('assert');

describe('custom filters', function() {
  beforeEach(function() {
    pug.filters.clear();
  });

  afterEach(function() {
    pug.filters.clear();
  });

  describe('register via filters.register()', function() {
    it('registers and invokes a custom markdown filter', function() {
      pug.filters.register('markdown', function(str, options) {
        assert.strictEqual(typeof options, 'object');
        return '<p>' + str.replace(/\n/g, '<br>') + '</p>';
      });

      var tmpl = pug.compile(
        'div\n' +
        '  :markdown\n' +
        '    Hello World\n' +
        '    Second line'
      );
      var html = tmpl();
      assert(html.indexOf('<p>Hello World<br>Second line</p>') !== -1);
    });

    it('registers and invokes a custom uglify filter', function() {
      pug.filters.register('uglify', function(str) {
        return str.replace(/\s+/g, ' ').trim();
      });

      var tmpl = pug.compile(
        'script\n' +
        '  :uglify\n' +
        '    function   foo()   {\n' +
        '      return   1   +   2;\n' +
        '    }'
      );
      var html = tmpl();
      assert(html.indexOf('function foo() { return 1 + 2; }') !== -1);
    });

    it('supports filter options', function() {
      pug.filters.register('wrap', function(str, options) {
        var prefix = options.prefix || '<<';
        var suffix = options.suffix || '>>';
        return prefix + str + suffix;
      });

      var tmpl = pug.compile(
        'div\n' +
        '  :wrap(prefix="[[", suffix="]]")\n' +
        '    content'
      );
      var html = tmpl();
      assert(html.indexOf('[[content]]') !== -1);
    });

    it('throws TypeError if name is not a non-empty string', function() {
      assert.throws(function() {
        pug.filters.register('', function() {});
      }, TypeError);
      assert.throws(function() {
        pug.filters.register(123, function() {});
      }, TypeError);
    });

    it('throws TypeError if filter is not a function', function() {
      assert.throws(function() {
        pug.filters.register('bad', 'not a function');
      }, TypeError);
      assert.throws(function() {
        pug.filters.register('bad', null);
      }, TypeError);
    });

    it('unregister removes a filter', function() {
      pug.filters.register('temp', function(str) {
        return 'TMP:' + str;
      });
      assert.strictEqual(typeof pug.filters.temp, 'function');
      pug.filters.unregister('temp');
      assert.strictEqual(pug.filters.temp, null);
    });

    it('get() retrieves a registered filter', function() {
      var fn = function(str) { return str; };
      pug.filters.register('getter', fn);
      assert.strictEqual(pug.filters.get('getter'), fn);
      assert.strictEqual(pug.filters.get('nonexistent'), null);
    });

    it('all() returns all registered filters', function() {
      var fn1 = function() {};
      var fn2 = function() {};
      pug.filters.register('one', fn1);
      pug.filters.register('two', fn2);
      var all = pug.filters.all();
      assert.strictEqual(all.one, fn1);
      assert.strictEqual(all.two, fn2);
      assert.deepEqual(Object.keys(all).sort(), ['one', 'two']);
    });

    it('clear() removes all registered filters', function() {
      pug.filters.register('a', function() {});
      pug.filters.register('b', function() {});
      assert.strictEqual(Object.keys(pug.filters.all()).length, 2);
      pug.filters.clear();
      assert.strictEqual(Object.keys(pug.filters.all()).length, 0);
    });
  });

  describe('backward compatibility: direct property assignment', function() {
    it('registers filter via direct property assignment', function() {
      pug.filters.bwcompat = function(str) {
        return 'BW:' + str;
      };

      var tmpl = pug.compile(
        'div\n' +
        '  :bwcompat\n' +
        '    test'
      );
      var html = tmpl();
      assert(html.indexOf('BW:test') !== -1);
    });

    it('reads previously registered filter via property access', function() {
      var fn = function(str) { return str; };
      pug.filters.register('readback', fn);
      assert.strictEqual(pug.filters.readback, fn);
    });

    it('"in" operator works for registered filters', function() {
      pug.filters.register('hascheck', function() {});
      assert('hascheck' in pug.filters);
      assert('definitelynothere' in pug.filters === false);
    });
  });

  describe('register via compile options', function() {
    it('passes filters via pug.compile options', function() {
      var html = pug.render(
        'div\n' +
        '  :uppercase\n' +
        '    hello',
        {
          filters: {
            uppercase: function(str) {
              return str.toUpperCase();
            },
          },
        }
      );
      assert(html.indexOf('HELLO') !== -1);
    });

    it('options filters take precedence over global filters', function() {
      pug.filters.register('whoami', function() {
        return 'global';
      });

      var html = pug.render(
        'div\n' +
        '  :whoami\n' +
        '    x',
        {
          filters: {
            whoami: function() {
              return 'local';
            },
          },
        }
      );
      assert(html.indexOf('local') !== -1);
      assert(html.indexOf('global') === -1);
    });

    it('does not mutate global filters when using options', function() {
      pug.filters.register('persist', function() {
        return 'persist-global';
      });

      pug.render(
        'div\n' +
        '  :persist\n' +
        '    x',
        {
          filters: {
            tempOnly: function() {
              return 'temp';
            },
          },
        }
      );

      assert.strictEqual(pug.filters.tempOnly, null);
      var all = pug.filters.all();
      assert.strictEqual(Object.keys(all).length, 1);
      assert('persist' in all);
    });
  });

  describe('error handling', function() {
    it('wraps filter errors with location info when no filename', function() {
      pug.filters.register('bad', function() {
        throw new Error('something went wrong inside the filter');
      });

      var err;
      try {
        pug.compile(
          'div\n' +
          '  :bad\n' +
          '    content'
        )();
      } catch (ex) {
        err = ex;
      }

      assert(err, 'Expected an error to be thrown');
      assert.strictEqual(err.code, 'PUG:FILTER_ERROR');
      assert(err.msg.indexOf('"bad"') !== -1);
      assert(err.msg.indexOf('something went wrong inside the filter') !== -1);
      assert.strictEqual(err.line, 2);
    });

    it('wraps filter errors with filename and location info', function() {
      pug.filters.register('bad2', function() {
        throw new Error('boom');
      });

      var err;
      try {
        pug.compile(
          'html\n' +
          '  body\n' +
          '    :bad2\n' +
          '      data',
          {filename: 'test-template.pug'}
        )();
      } catch (ex) {
        err = ex;
      }

      assert(err);
      assert.strictEqual(err.code, 'PUG:FILTER_ERROR');
      assert.strictEqual(err.line, 3);
      assert.strictEqual(err.filename, 'test-template.pug');
    });

    it('handles non-Error values thrown from filter', function() {
      pug.filters.register('thrower', function() {
        throw 'just a string error';
      });

      var err;
      try {
        pug.compile(
          ':thrower\n' +
          '  content'
        )();
      } catch (ex) {
        err = ex;
      }

      assert(err);
      assert.strictEqual(err.code, 'PUG:FILTER_ERROR');
      assert(err.msg.indexOf('just a string error') !== -1);
    });

    it('passes through pre-existing PUG errors without double-wrapping', function() {
      var pugError = require('pug-error');
      pug.filters.register('pugerr', function() {
        throw pugError('CUSTOM_ERR', 'custom message', {
          line: 99,
          column: 5,
          filename: 'custom.pug',
        });
      });

      var err;
      try {
        pug.compile(
          ':pugerr\n' +
          '  content'
        )();
      } catch (ex) {
        err = ex;
      }

      assert(err);
      assert.strictEqual(err.code, 'PUG:CUSTOM_ERR');
      assert.strictEqual(err.msg, 'custom message');
      assert.strictEqual(err.line, 99);
    });

    it('error message contains source location and file info', function() {
      pug.filters.register('ctxerr', function() {
        throw new Error('filter exploded');
      });

      var err;
      try {
        pug.compile(
          'div first\n' +
          '  :ctxerr\n' +
          '    problem\n' +
          '    here',
          {filename: __dirname + '/context-test.pug'}
        )();
      } catch (ex) {
        err = ex;
      }

      assert(err);
      var msg = err.message;
      assert(msg.indexOf('filter exploded') !== -1);
      assert(msg.indexOf('context-test.pug') !== -1);
      assert.strictEqual(err.line, 2);
      assert.strictEqual(err.filename, __dirname + '/context-test.pug');
    });
  });
});
