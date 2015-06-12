var gulp = require('gulp');
var server = require('gulp-develop-server');
var jasmine = require('gulp-jasmine');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var minifyCSS = require('gulp-minify-css');
var zip = require("gulp-zip");

// concat css
gulp.task('css', function() {
	return gulp.src([
		'./app/css/reset.css',
		'./app/css/buttons.css',
		'./app/css/jnotify.css',
		'./app/css/application.css'
	])
	.pipe(concat('galileo.css'))
	.pipe(minifyCSS())
	.pipe(gulp.dest('./app/css/'));
});

// concat js
// shared libraries
var scripts = [
	'./bower_components/json2/json2.js',
	'./bower_components/jquery/dist/jquery.js',
	'./bower_components/underscore/underscore.js',
	'./bower_components/backbone/backbone.js',

	'./bower_components/spin.js/spin.js',
	'./app/js/libraries/store.js',
	'./app/js/vendors/oauth.js',
	'./bower_components/twitter-text-js/js/twitter-text.js',
	'./app/js/vendors/jnotify.js'
];

gulp.task('scripts-signin', function() {
	var source = scripts.slice();

	source.push.apply(source, [
		'./app/js/views/signin_view.js'
	]);

	return gulp.src(source)
		.pipe(concat('signin.js'))
		.pipe(uglify())
		.pipe(gulp.dest('./app/js/'));
});

gulp.task('scripts-galileo', function() {
	var source = scripts.slice();

	source.push.apply(source, [
		'./app/js/models/*.js',
		'./app/js/collections/*.js',
		'./app/js/views/user_view.js',
		'./app/js/views/app_view.js'
	]);

	return gulp.src(source)
		.pipe(concat('galileo.js'))
		.pipe(uglify())
		.pipe(gulp.dest('./app/js/'));
});

// create distribution
gulp.task('zip', function() {
	return gulp.src([
		'./**',
		'!./css/application.css',
		'!./css/buttons.css',
		'!./css/jnotify.css',
		'!./css/reset.css',
		
		'!./js/collections/',
		'!./js/collections/**',
		
		'!./js/controllers/',
		'!./js/controllers/**',
		
		'!./js/libraries/',
		'!./js/libraries/**',
		
		'!./js/models/',
		'!./js/models/**',
		
		'!./js/vendors/',
		'!./js/vendors/**',
		
		'!./js/views/',
		'!./js/views/**'
	], {cwd: __dirname + "/app"})
	.pipe(zip('Galileo.zip'))
	.pipe(gulp.dest('dist'));
});


// watch for code changes
gulp.task('watch', function() {
	gulp.watch(['./app/css/*.css', '!./app/css/galileo.css', 
				'./app/js/**/*.js', '!./app/js/**/signin.js', '!./app/js/**/galileo.js',
				'./app/*.html'], ['css', 'scripts']);
});


// Build Production Files, the Default Task
gulp.task('default', ['concat', 'watch']);

gulp.task('scripts', ['scripts-signin', 'scripts-galileo']);

gulp.task('concat', ['css', 'scripts']);

gulp.task('dist', ['concat', 'zip']);
