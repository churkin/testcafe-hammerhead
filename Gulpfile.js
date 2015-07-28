/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Useful tasks:
//
//      $ gulp mocha                        - run mocha tests
//      $ gulp qunit                        - run qunit test page
//      $ gulp playground                   - run Hammerhead playground page
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var babel      = require('babel');
var gulpBabel  = require('gulp-babel');
var del        = require('del');
var eslint     = require('gulp-eslint');
var fs         = require('fs');
var gulp       = require('gulp');
var mocha      = require('gulp-mocha');
var mustache   = require('gulp-mustache');
var rename     = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
//var uglify     = require('gulp-uglify');
var webmake = require('gulp-webmake');
var chalk   = require('chalk');
var Promise = require('promise');

function makePromise (fn) {
    return { then: fn };
}

var HangPromise = makePromise(function () {
    //Never resolves =)
});

gulp.task('clean', function () {
    return makePromise(function (done) {
        del(['./lib'], done);
    });
});

gulp.task('templates', function () {
    return gulp
        .src('client/templates/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts', ['client-scripts-bundle'], function () {
    return gulp.src('./client/templates/hammerhead.js.mustache')
        .pipe(mustache({
            source:    fs.readFileSync('./lib/client/hammerhead.js').toString(),
            sourceMap: ''
        }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts-bundle', function () {
    return gulp.src('./client/hammerhead.js')
        .pipe(webmake({
            sourceMap: false,
            transform: function (filename, code) {
                var transformed = babel.transform(code, { sourceMap: false, blacklist: ['strict'] });

                return {
                    code:      transformed.code,
                    sourceMap: transformed.map
                };
            }
        }))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('server-scripts', function () {
    return gulp.src(['src/**/*.js', 'shared/**/*.js'])
        .pipe(sourcemaps.init())
        .pipe(gulpBabel())
        .pipe(sourcemaps.write('.', {
            includeContent: true,
            sourceRoot:     '../src'
        }))
        .pipe(gulp.dest('lib/'));
});

gulp.task('lint', function () {
    return gulp
        .src([
            '!./client/json.js',
            '!./shared/js-parsing-tools.js',
            './client/**/*.js',
            './shared/**/*.js',
            './src/**/*.js',
            './test/mocha/fixtures/**/*.js',
            //'./test/qunit/fixtures/**/*.js',
            'Gulpfile.js'
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('build', ['client-scripts', 'server-scripts', 'templates', 'lint']);

gulp.task('mocha', ['build'], function () {
    return gulp.src('test/mocha/*-test.js', { read: false })
        .pipe(mocha({
            ui:       'bdd',
            reporter: 'spec',
            // NOTE: disable timeouts in debug
            timeout:  typeof v8debug === 'undefined' ? 2000 : Infinity
        }));
});

gulp.task('qunit', ['build'], function () {
    gulp.watch(['./client/**', './test/qunit/fixtures/**'], ['build']);

    require('./test/qunit/server.js').start();

    return HangPromise;
});

gulp.task('playground', ['build'], function () {
    require('./test/playground/server.js').start();

    return HangPromise;
});

gulp.task('travis', [process.env.GULP_TASK || '']);

(function SAUCE_LABS_QUNIT_TESTING () {
    var SauceTunnel = require('sauce-tunnel');
    var QUnitRunner = require('./test/qunit/sauce-labs-runner');

    var SAUCE_LABS_USERNAME = process.env.SAUCE_LABS_USERNAME || '';
    var SAUCE_LABS_PASSWORD = process.env.SAUCE_LABS_PASSWORD || '';

    var RUN_TESTS_URL = '/run-dir?dir=fixtures/hammerhead_client';
    var BROWSERS      = [
        {
            browserName: 'chrome',
            platform:    'Windows 7'
        }];

    function openSauceTunnel (username, password, id, tunneled) {
        return new Promise(function (resolve, reject) {
            var tunnel = new SauceTunnel(username, password, id, tunneled);

            tunnel.start(function (isCreated) {
                if (!isCreated)
                    reject('Failed to create Sauce tunnel');
                else
                    resolve(tunnel);
            });
        });
    }

    function stopSauceTunnel (tunnel) {
        return new Promise(function (resolve) {
            tunnel.stop(resolve);
        });
    }

    function checkFailures (results) {
        var errors = [];

        results[0].forEach(function (platformResults) {
            var msg      = [];
            var platform = [platformResults.platform[0], platformResults.platform[1], platformResults.platform[2] ||
                                                                                      ''].join(' ');

            msg.push(chalk.bold(platformResults.result.failed ? chalk.red('FAILURES:') : chalk.green('OK:')));
            msg.push(platform);
            msg.push(chalk.bold('Total:'), platformResults.result.total);
            msg.push(chalk.bold('Failed:'), platformResults.result.failed);

            console.log(msg.join(' '));

            if (platformResults.result.errors) {
                platformResults.result.errors.forEach(function (error) {
                    error.platform = platform;
                    errors.push(error);
                });
            }
        });

        return errors;
    }

    function reportFailures (errors) {
        console.log(chalk.bold.red('ERRORS:'));

        errors.forEach(function (error) {
            console.log(chalk.bold(error.platform + ' - ' + error.testPath));
            console.log(chalk.bold('Test: ' + error.testName));

            if (error.customMessage)
                console.log('message: ' + error.customMessage);

            if (error.expected) {
                console.log('expected: ' + error.expected);
                console.log('actual: ' + error.actual);
            }

            console.log('-------------------------------------------');
            console.log();
        });
    }

    gulp.task('qunit-travis', ['Hammerhead-Build', 'run-tests', 'sauce-end'], function () {
        var qUnitServerUrl = require('./test/qunit/server.js').start(true);
        var sauceTunnelId  = Math.floor((new Date()).getTime() / 1000 - 1230768000).toString();
        var sauceTunnel    = null;

        return openSauceTunnel(SAUCE_LABS_USERNAME, SAUCE_LABS_PASSWORD, sauceTunnelId, true)
            .then(function (tunnel) {
                sauceTunnel = tunnel;

                var runner = new QUnitRunner({
                    username:         SAUCE_LABS_USERNAME,
                    key:              SAUCE_LABS_PASSWORD,
                    build:            process.env.TRAVIS_JOB_ID || '',
                    browsers:         BROWSERS,
                    tunnelIdentifier: sauceTunnelId,
                    urls:             [qUnitServerUrl + RUN_TESTS_URL],
                    tags:             [process.env.TRAVIS_BRANCH || 'master']
                });

                return runner.runTests();
            })
            .then(function (results) {
                var errors = checkFailures(results);

                if (errors.length) {
                    reportFailures(errors);
                    throw 'tests failed';
                }
            })
            .then(function () {
                return stopSauceTunnel();
            })
            .catch(function (err) {
                stopSauceTunnel(sauceTunnel)
                    .then(function () {
                        throw err;
                    });
            });
    });
})();
