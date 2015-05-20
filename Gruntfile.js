'use strict';

module.exports = function (grunt) {

  require('load-grunt-tasks')(grunt);
  require('time-grunt')(grunt);

  grunt.initConfig({

    bumpup: {
      files: [
        'package.json',
        'bower.json'
      ]
    },

    copy: {
      all: {
        files: [{
          src: 'src/woff2otf.js',
          dest: 'dist/',
          flatten: true,
          filter: 'isFile',
          expand: true
        }]
      }
    },

    eslint: {
      all: [
        'Gruntfile.js',
        'index.js'
      ]
    },

    module: {
      'check-repository': {
        options: {
          check: true
        }
      },

      'release-publish': {
        options: {
          release: true,
          publish: true
        }
      }
    },

    umd: {
      all: {
        src: 'dist/woff2otf.js',
        dest: 'dist/woff2otf.js',
        globalAlias: 'woff2otf',
        template: 'unit'
      }
    },

    uglify: {
      all: {
        src: ['dist/woff2otf.js'],
        dest: 'dist/woff2otf.min.js'
      }
    }

  });

  grunt.registerTask('build', [
    'eslint',
    'copy',
    'umd',
    'uglify'
  ]);

  grunt.registerTask('publish', function (type) {
    grunt.task.run('build');
    grunt.task.run('module:check-repository');
    grunt.task.run('bumpup:' + type);
    grunt.task.run('module:release-publish');
  });

  grunt.registerTask('default', ['build']);

};
