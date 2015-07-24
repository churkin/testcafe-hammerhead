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

gulp.task('travis', [process.env.GULP_TASK]);

(function SAUCE_LABS_QUNIT_TESTING () {
    var SauceTunnel = require('sauce-tunnel');
    var QUnitRunner = require('./test/qunit/sauce-labs-runner');
    var gulpConnect = require('gulp-connect');

    var SAUCE_LABS_USERNAME = process.env.SAUCE_LABS_USERNAME || '';
    var SAUCE_LABS_PASSWORD = process.env.SAUCE_LABS_PASSWORD || '';
    var BROWSERS            = [
        {
            browserName: "chrome",
            platform:    "Windows 7"
        }];

    var tunnelIdentifier  = Math.floor((new Date()).getTime() / 1000 - 1230768000).toString();
    var sauceTunnel       = null;
    var sauceTunnelOpened = false;
    var taskSucceed       = true;
    var qUnitServerUrl    = null;

    gulp.task('open-connect', function () {
        gulpConnect.server({
            root: '',
            port: 1335
        });
    });

    gulp.task('sauce-start', function () {
        return new Promise(function (resolve, reject) {
            sauceTunnel = new SauceTunnel(SAUCE_LABS_USERNAME, SAUCE_LABS_PASSWORD, tunnelIdentifier, true);

            sauceTunnel.start(function (isCreated) {
                if (!isCreated)
                    reject('Failed to create Sauce tunnel');
                else {
                    sauceTunnelOpened = true;
                    resolve('Connected to Sauce Labs');
                }
            });
        });
    });

    gulp.task('run-tests', ['Hammerhead-Build', 'run-qunit-server', 'sauce-start'], function (callback) {
        var runner = new QUnitRunner({
            username:         SAUCE_LABS_USERNAME,
            key:              SAUCE_LABS_PASSWORD,
            build:            process.env.TRAVIS_JOB_ID || '',
            browsers:         BROWSERS,
            tunnelIdentifier: tunnelIdentifier,
            urls:             [qUnitServerUrl + '/run-dir?dir=fixtures/hammerhead_client'],
            tags:             [process.env.TRAVIS_BRANCH || 'master']
        });

        runner.runTests(function (results) {
            function bold (text) {
                return '\033[1m' + text + '\033[22m';
            }

            function red (text) {
                return '\033[31m' + text + '\033[39m';
            }

            function green (text) {
                return '\033[32m' + text + '\033[39m';
            }

            var errors = [];

            results[0].forEach(function (platformResults) {
                var msg      = [];
                var platform = [platformResults.platform[0], platformResults.platform[1], platformResults.platform[2] ||
                                                                                          ''].join(' ');

                msg.push(bold(platformResults.result.failed ? red('FAILURES:') : green('OK:')));
                msg.push(platform);
                msg.push(bold('Total:'), platformResults.result.total);
                msg.push(bold('Failed:'), platformResults.result.failed);

                console.log(msg.join(' '));

                if (platformResults.result.errors) {
                    platformResults.result.errors.forEach(function (error) {
                        error.platform = platform;
                        errors.push(error);
                    });
                }

            });

            taskSucceed = !errors.length;

            if (!taskSucceed) {
                console.log(bold(red('ERRORS:')));

                errors.forEach(function (error) {
                    console.log(bold(error.platform + ' - ' + error.testPath));
                    console.log(bold('Test: ' + error.testName));

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

            callback();
        });
    });

    gulp.task('sauce-end', ['run-tests'], function (callback) {
        sauceTunnelOpened = false;
        sauceTunnel.stop(callback);
    });

    gulp.task('close-connect', ['run-tests'], function () {
        gulpConnect.serverClose();
    });

    gulp.task('run-qunit-server', function () {
        qUnitServerUrl = require('./test/qunit/server.js').start(true);
    });

    gulp.task('Qunit-Farm', ['Hammerhead-Build', 'run-tests', 'sauce-end'], function () {
        if (!taskSucceed)
            process.exit(1);
    });

    gulp.on('err', function () {
        if (sauceTunnelOpened)
            sauceTunnel.stop(new Function());
    });
})();
