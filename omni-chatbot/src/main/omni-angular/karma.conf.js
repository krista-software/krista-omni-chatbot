// Karma configuration.
//
// This file exists (rather than relying on the Angular CLI's internal default
// karma config) so that karma plugins are loaded via explicit require() calls,
// which resolve relative to THIS file's node_modules. Without it, IDE test
// runners (WebStorm/IntelliJ karma-intellij wrapper) anchor plugin resolution
// at the IDE project root (the repo root, which has no node_modules) and fail
// with "Cannot find module 'karma-jasmine'".
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // Available options: https://jasmine.github.io/api/edge/Configuration.html
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/omni-angular'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    // Headless launcher used by the gradle build (npm run test:ci). The extra flags
    // are what CI containers need: --no-sandbox because karma often runs as root,
    // and --disable-dev-shm-usage because the default /dev/shm in Docker is too
    // small and makes Chrome crash mid-run. Both are harmless on a developer Mac.
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      }
    },
    // CI hardening. Karma's defaults are tight enough that a browser started on a
    // loaded build agent (the Angular specs run right after the Java suite) can be
    // dropped mid-run and fail the build spuriously — observed once as "Executed 3 of
    // 1014" then an abort. Give Chrome room to capture, and tolerate a transient
    // disconnect instead of turning it into a red build.
    captureTimeout: 120000,
    browserDisconnectTimeout: 30000,
    browserDisconnectTolerance: 2,
    browserNoActivityTimeout: 120000,
    restartOnFileChange: true
  });
};
