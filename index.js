var wd = require('wd');
var url = require('url');

var Safari = function(baseBrowserDecorator, args, logger) {
  baseBrowserDecorator(this);

  var config = Object.assign({
    protocol: 'http:',
    hostname: '127.0.0.1',
    port: 4444,
    pathname: '/'
  }, args.config);

  var webDriver = url.format(config);
  this.name = 'Safari via WebDriver at ' + webDriver;
  var log = logger.create(this.name);

  log.debug(JSON.stringify(args));
  log.debug(JSON.stringify(config));

  this.driver = wd.remote(config);

  this.driver.on('status', (info) => {
    log.debug('Status: ' + info);
  });

  this.driver.on('command', (eventType, command, response) => {
    log.debug('[command] ' + eventType + ' ' + command + ' ' + (response || ''));
  });

  this.driver.on('http', (meth, path, data) => {
    log.debug('[http] ' + meth + ' ' + path + ' ' + (data || ''));
  });

  this._getOptions = function() {
    return [
      "-p", config.port.toString()
    ];
  }

  const superStart = this._start;
  // Stop the default start from occuring
  this._start = () => {};

  /**
   * This launcher works by checking to see if there is a `/usr/bin/safaridriver` instance running.
   * It is determined to be running if the web driver API can be reached on the configured host and port.
   * If it is then it it launches the Karma test runner in a new session. If it is not, it then attempts
   * to start its own new instance of `/usr/bin/safaridriver` and then connect the Karma test runner in
   * a new session.
   *
   * @param {string} url The URL that the Karma server is listening on.
   */
  this.on('start', function(url) {
    var self = this;

    var attempts = 0;
    // TODO: It would be nice if this was configurable
    const MAX_ATTEMPTS = 10;
    // TODO: It would be nice if this was configurable
    const SLEEP_DURATION = 500;

    const webDriverConfig = {
      browserName: 'safari',
      allowW3C: true
    };

    function attachKarma(error) {
      attempts += 1;
      if (error && error.code === 'ECONNREFUSED' && attempts === 1) {
        log.debug('attachKarma ' + attempts + ' of ' + MAX_ATTEMPTS);
        log.debug(self._getCommand() + ' is not running.');
        log.debug('Attempting to start ' + self._getCommand() + ' ' + self._getOptions(url).join(' '));
        superStart(url);
        self.driver.init(webDriverConfig, attachKarma);
      } else if (error && error.code === 'ECONNREFUSED' && attempts <= MAX_ATTEMPTS) {
        log.debug('attachKarma ' + attempts + ' of ' + MAX_ATTEMPTS);
        log.debug('Going to give the driver time to start-up. Sleeping for ' + SLEEP_DURATION + 'ms.');
        setTimeout(function() {
          log.debug('Awoke to retry.');
          self.driver.init(webDriverConfig, attachKarma);
        }, SLEEP_DURATION);
      } else if (error) {
        log.error('Could not connect to Safari.');
        log.error(error);
      } else {
        log.debug('Connected to Safari WebDriver');
        log.debug('Connecting to ' + url);
        self.driver.get(url);
      }
    }

    self.driver.init(webDriverConfig, attachKarma);
  });

  this.on('kill', (done) => {
    if (this.driver) {
      this.driver.quit(function() {
        done();
      });
    } else {
      done();
    }
  });
};

Safari.prototype = {
  name: 'Safari',

  DEFAULT_CMD: {
    darwin: '/usr/bin/safaridriver'
  },
  ENV_CMD: 'SAFARI_BIN'
};

Safari.$inject = ['baseBrowserDecorator', 'args', 'logger'];

var SafariLegacy = function(baseBrowserDecorator) {
  baseBrowserDecorator(this);

  this._start = function(url) {
    var HTML_TPL = path.normalize(__dirname + '/safari.html');
    var self = this;

    fs.readFile(HTML_TPL, function(err, data) {
      var content = data.toString().replace('%URL%', url);
      var staticHtmlPath = self._tempDir + '/redirect.html';

      fs.writeFile(staticHtmlPath, content, function(err) {
        self._execCommand(self._getCommand(), [staticHtmlPath]);
      });
    });
  };
};

SafariLegacy.prototype = {
  name: 'Safari',

  DEFAULT_CMD: {
    darwin: '/Applications/Safari.app/Contents/MacOS/Safari',
    win32: process.env['ProgramFiles(x86)'] + '\\Safari\\Safari.exe'
  },
  ENV_CMD: 'SAFARI_BIN'
};

SafariLegacy.$inject = ['baseBrowserDecorator'];

// PUBLISH DI MODULE
module.exports = {
  'launcher:Safari': ['type', Safari],
  'launcher:SafariLegacy': ['type', SafariLegacy]
};
