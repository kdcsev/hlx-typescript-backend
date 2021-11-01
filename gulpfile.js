
var gulp = require('gulp');
var zip = require('gulp-zip');

var paths = {
    html: 'src',
    public: 'spec',
    backup: 'backup',
};

//Create backup zip file
gulp.task('backup', function () {
    Date.prototype.yyyymmdd = function() {
        var yyyy = this.getFullYear().toString();
        var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
        var dd  = this.getDate().toString();
        var hh  = this.getHours().toString();
        return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]) + '-' + hh;
    };
    var date = new Date();
    var filename =  'mlm-node-typescript-source-'+ date.yyyymmdd() + '.zip';
    return gulp.src([
            paths.html + '/**/*.*',
            paths.public + '/**/*.*',
            'gulpfile.js',
            'package.json',
            'tsconfig.json',
            'nodemon.json',
            'tslint.json',
            '.env'
        ], {base: './'})
        .pipe(zip(filename))
        .pipe(gulp.dest(paths.backup))
});

