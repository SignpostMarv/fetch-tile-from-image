/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Task configuration.
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        esnext: true,
        browser: true,
        globals: {
          console: true,
          fetch: true,
          require: true,
          define: true
        }
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      lib: {
        src: [
          'lib/**/*.js'
        ]
      }
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: [
          'jshint:gruntfile'
        ]
      },
      lib: {
        files: [
          'lib/js/*.js'
        ],
        tasks: [
          'jshint:lib'
        ]
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task.
  grunt.registerTask('default', [
    'jshint'
  ]);

};
