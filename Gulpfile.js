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
        .src('./src/client/templates/task.js.mustache', { silent: false })
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts', ['client-scripts-bundle'], function () {
    return gulp.src('./src/client/templates/hammerhead.js.mustache')
        .pipe(mustache({
            source:    fs.readFileSync('./lib/client/hammerhead.js').toString(),
            sourceMap: ''
        }))
        .pipe(rename('hammerhead.js'))
        .pipe(gulp.dest('./lib/client'));
});

gulp.task('client-scripts-bundle', function () {
    return gulp.src('./src/client/hammerhead.js')
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
    return gulp.src(['./src/**/*.js', '!./src/client/**/*.js'])
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
            './src/**/*.js',
            '!./src/client/json.js',
            '!./src/processing/js-parsing-tools.js',
            './test/mocha/fixtures/**/*.js',
            './test/qunit/fixtures/**/*.js',
            'Gulpfile.js'
        ])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('build', ['client-scripts', 'server-scripts', 'templates', 'lint']);

gulp.task('mocha', ['build'], function () {
    return gulp.src('./test/mocha/*-test.js', { read: false })
        .pipe(mocha({
            ui:       'bdd',
            reporter: 'spec',
            // NOTE: disable timeouts in debug
            timeout:  typeof v8debug === 'undefined' ? 2000 : Infinity
        }));
});

gulp.task('qunit', ['build'], function () {
    gulp.watch(['./src/**', './test/qunit/fixtures/**'], ['build']);

    require('./test/qunit/server.js').start();

    return HangPromise;
});

gulp.task('playground', ['build'], function () {
    require('./test/playground/server.js').start();

    return HangPromise;
});

