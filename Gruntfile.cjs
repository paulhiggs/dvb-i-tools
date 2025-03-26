module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: '',
        process: function(src, filepath) {
          return '// file:' + filepath + '\n' + src;
        }
      },
      all: {
        src: ['all-in-one.js',
							'cg_check.js',
							'classification_scheme_loaders.js',
							'classification_scheme.js',
							'CMCD.js',
							'common_errors.js',
//							'csr.js',
					    'data_locaions.js',
							'DVB_definitions.js',
							'DVB-I_definitions.js',
							'error_list.js',
							'fetch_err_handler.js',
							'globals.js',
							'IANA_languages.js',
							'identifiers.js',
							'ISO_countries.js',
							'logger.js',
							'MIME_checks.js',
							'MPEG7_definitions.js',
							'multilingual_element.js',
							'pattern_checks.js',
							'related_material_checks.js',
							'role_loader.js',
							'role.js',
							'schema_checks.js',
							'sl_check.js',
							'sl_data_versions.js',
							'slepr.js',
							'TVA_definitions.js',
							'ui.js',
							'URI_checks.js',
							'utils.js',
							'validator.js'


        ],
        dest: 'dist/<%= pkg.name %>.all.js'
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n',
        sourceMap: true
      },
      all: {
        files: {
          'dist/<%= pkg.name %>.all.min.js': ['<%= concat.all.dest %>']
        }
      },
    },
  	jshint: {
      files: [
        'Gruntfile.js',
        'src/**/*.js',
        'test/**/*.js',
        // Exclude the following from lint
        '!test/lib*/**/*.js',
        '!test/mp4/**/*.js',
        '!test/trackviewers/**/*.js',
        '!test/coverage/**/*.js',
      ],
      options: {
        // options here to override JSHint defaults
        eqeqeq: false,
        asi: true,
        //verbose: true,
	      loopfunc: true,
        eqnull: true,
	      reporterOutput: "",
          globals: {
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['default']
    },

    bump: {
      options: {
        files:  ['package.json'],
        pushTo: 'origin'
      }
    },
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-bump');

  grunt.registerTask('all', [ 'concat:all', 'uglify:all']);
	grunt.registerTask('default', [ 'all',]);

//  grunt.registerTask('default', [ 'jshint', 'all',]);
//  grunt.registerTask('test', ['default']);

};
