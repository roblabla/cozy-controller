
var fs = require('fs'),
    path = require('path'),
    spawn = require('child_process').spawn,
    async = require('flatiron').common.async,
    haibu = require('../../haibu');

var useraccounts = exports;


function makeNPMConfiguration(dir, target, callback) {
  async.parallel([
    //
    // Make the .npm folder for the npm cache
    //
    function makeDotNpm(next) {
      haibu.utils.mkdirp(path.join(dir, '..', '.npm'), next)
    },
    //
    // Make the .tmp folder for temporary npm files
    //
    function makeDotTmp(next) {
      haibu.utils.mkdirp(path.join(dir, '..', '.tmp'), next)
    },
    //
    // Create an empty .userconfig and .globalconfig for npm
    //
    async.apply(fs.writeFile, path.join(dir, '..', '.userconfig'), ''),
    async.apply(fs.writeFile, path.join(dir, '..', '.globalconfig'), '')
  ], function (err) {
    if (err) return callback(err);
    if (!fs.existsSync(dir + '/log')){
      fs.mkdirSync(dir + '/log')
    }
    fs.openSync(dir + '/log/'+ process.env.NODE_ENV + '.log', 'a')
    var child = spawn(
        'chown',
        ['-R', haibu.config.get('useraccounts:prefix') + target.user, '.'],
        {cwd:path.join(dir, '..', '..')}
    );
    child.on('exit', function (code) {
      callback(code ? new Error('Unable to change permissions on npm configuration') : null);
    });
  });
}

var _spawnOptions = haibu.getSpawnOptions;
haibu.getSpawnOptions = function getSpawnOptions(target) {
  var options = _spawnOptions.apply(this, arguments);
  options.env.USER = haibu.config.get('useraccounts:prefix') + target.user;
  options.env.HOME = path.join(haibu.config.get('directories:apps'), target.user);
  options.env.TEMP = path.join(options.env.HOME, target.name, '.tmp');
  options.env.TMPDIR = path.join(options.env.HOME, target.name, '.tmp');
  options.env.PATH = process.env.PATH;
  return options;
}

function spawnNPM(dir, target, callback) {
  var noNpm = haibu.config.get('no-npm'),
      appDir = dir,
      stderr = '',
      args,
      meta;

  if (noNpm === true) {
    return callback(null, []);
  }

  meta = {
    app: target.name,
    user: target.user,
    dependencies: target.dependencies
  };
  if (typeof target.dependencies === 'undefined' || Object.keys(target.dependencies).length === 0) {
    haibu.emit('npm:install:none', 'info', meta);
    callback(null, []);
    return;
  }

  haibu.emit('npm:install:start', 'info', meta);

  function spawnNpm (err) {
    try {
      var spawnOptions = haibu.getSpawnOptions(target);
    }
    catch (e) {
      callback(e);
      return;
    }
    args = [
      'npm',
      // package.json scripts freak out from node-pack in some versions, sudo -u + this are workaround
      '--unsafe-perm', 'true',
      //only use cache for app
      '--cache', path.join(dir,'..','.npm'),
      //use blank or non-existent user config
      '--userconfig', path.join(dir,'..','.userconfig'),
      //use non-existant user config
      '--globalconfig', path.join(dir,'..','.globalconfig'),
      '--production'
    ];
    if (haibu.config.get('registry') != null){
      args.push('--registry')     
      args.push(haibu.config.get('registry'))
    }
    if (haibu.config.get('strict-ssl') != null){
      args.push('--strict-ssl')     
      args.push(haibu.config.get('strict-ssl'))
    }
    args.push('install')
    node_version = (process.versions.node).split('.')
    if (node_version[0] === '0' && parseInt(node_version[1]) < 10 ){
      args = [
        '-u',
        haibu.config.get('useraccounts:prefix') + target.user
        ].concat(args);
    }
    haibu.emit('npm:install:args', 'info', { args: args })
    spawnOptions.cwd = dir;
    child = spawn('sudo', args, spawnOptions);

    //
    // Kill NPM if this takes more than 5 minutes
    //
    setTimeout(child.kill.bind(child, 'SIGKILL'), 5 * 60 * 1000);

    child.stdout.on('data', function (data) {
      haibu.emit('npm:install:stdout', 'info', {
        data: data+'',
        meta: meta
      });
    });

    child.stderr.on('data', function (data) {
      stderr += data;
      haibu.emit('npm:install:stderr', 'info', {
        data: data+'',
        meta: meta
      });
    });

    child.on('close', function (code) {
      if (code) {
        var err = new Error('NPM Install failed');
        err.code = code;
        err.result = stderr;
        err.blame = {
          type: 'user',
          message: 'NPM failed to install dependencies'
        };

        haibu.emit('npm:install:failure', 'info', {
          code: code,
          meta: meta
        });

        callback(err);
        return;
      }
      haibu.emit('npm:install:success', 'info', meta);
      // Remove npm cache
      args = [
        'npm',
        //only use cache for app
        '--cache', path.join(dir,'..','.npm'),
        'cache', 'clean',
      ]
      if (node_version[0] === '0' && parseInt(node_version[1]) < 10 ){
        args = [
          '-u',
          haibu.config.get('useraccounts:prefix') + target.user
          ].concat(args);
      }
      spawnOptions.cwd = dir;
      child = spawn('sudo', args, spawnOptions);

      child.stdout.on('data', function (data) {
        haibu.emit('npm:clean_cache:stdout', 'info', {
          data: data+'',
          meta: meta
        });
      });

      child.stderr.on('data', function (data) {
        stderr += data;
        haibu.emit('npm:clean_cache:stderr', 'info', {
          data: data+'',
          meta: meta
        });
      });

      child.on('close', function (code) {
        if (code) {
          var err = new Error('NPM Install failed');
          err.code = code;
          err.result = stderr;
          err.blame = {
            type: 'user',
            message: 'NPM failed to install dependencies'
          };

          haibu.emit('npm:clean_cache:failure', 'info', {
            code: code,
            meta: meta
          });

          callback();
          return;
        }

        callback();
      });
    });
  }

  function rewritePackage(done) {
    var pkgFile = path.join(appDir, 'package.json');
    fs.readFile(pkgFile, 'utf8', function (err, data) {
      if (err) {
        //
        // TODO: Write a stripped down version of the package in memory
        // if no package exists on disk.
        //
        done(err);
        return;
      }

      var pkg;
      try {
        pkg = JSON.parse(data);
      }
      catch (ex) {
        //
        // TODO: Write a stripped down version of the package in memory
        // if there is an error in the package.json on disk.
        //
        done(err);
        return;
      }

      pkg.dependencies = target.dependencies;
      fs.writeFile(pkgFile, JSON.stringify(pkg, null, 2), 'utf8', done);
    });
  }

  //
  // Rewrite the package.json in the chroot'ed app dir
  // and then invoke `npm install`.
  //
  rewritePackage(spawnNpm);
};

haibu.common.npm.install = function (dir, target, callback) {
  makeNPMConfiguration(dir, target, function (err) {
    if (err) {
      callback(err);
      return;
    }
    spawnNPM(dir, target, callback);
  })
};



//
// ### function build (dirClient, target, callback)
// #### @dirClient {Repository} repository to build.
// #### @target {App} application to build
// #### @callback {function} Continuation passed to respond to.
// Brunch build application target
//
haibu.common.brunch.build = function (dirClient, target, callback) {
  var spawnOptions = haibu.getSpawnOptions(target);
  var stderr = '';

  //
  // Configure brunch build
  //
  spawnOptions.cwd = dirClient;
  args = [
    '-u',
    haibu.config.get('useraccounts:prefix') + target.user,
    'brunch',
    'build',
    '--optimize'
    ];
  if (fs.existsSync(dirClient + '/config-prod.coffee')) {
    var stats = fs.lstatSync(dirClient + '/config-prod.coffee');
    if (stats.isFile()) {
      args = [
        '-u',
        haibu.config.get('useraccounts:prefix') + target.user,
        'brunch',
        'build',
        '--optimize',
        '--config',
        'config-prod.coffee'
      ];
    };
  };
  //
  // Brunch build
  //
  brunch = spawn('sudo', args, spawnOptions);

  //
  // Check brunch build
  //
  brunch.stdout.on('data', function (data) {
    haibu.emit('brunch:build', 'info', {
      stdout: data
    });
  });

  brunch.stderr.on('data', function (data) {
    stderr += data;
    haibu.emit('npm:brunch:stderr', 'info', {
      data: data
    });
  });

  brunch.on('exit', function (code) {
    if (code || code == null) {
      var err = new Error('Brunch build failed');
      err.code = code;
      err.result = stderr;
      err.blame = {
        message: 'Brunch failed to build'
      };

      haibu.emit('brunch:build:failure', 'info', {
        code: code
      });
      return callback(err);
    } else {
      return callback();
    }
  });
}

useraccounts.name = 'useraccounts';

useraccounts.argv = function (repo) {
  var user = repo.app.user;
  return { argv: ['--plugin',
        'setuid',
        '--setuid',
        haibu.config.get('useraccounts:prefix') + user] };
}

useraccounts.attach = function (options) {
  permissions = options.permissions || 700;
  if (process.getuid() !== 0) {
    throw new Error('useraccounts plugin requires admin privileges.');
  }

  haibu.config.set('useraccounts:prefix', 'cozy-');


  var _install = haibu.common.npm.install;
  haibu.common.npm.install = function install(dir, target, callback) {
    var self = this;

    var env = {};
    for(var k in process.env) {
      env[k] = process.env[k];
    }

    var user = env.USER = haibu.config.get('useraccounts:prefix') + target.user;
    var appdir = env.HOME = path.join(haibu.config.get('directories:apps'), target.user);
    var child = spawn('bash', [path.join(__dirname, '..', 'common', 'adduser.sh')], {
        env: env
     });
    child.on('exit', function (code) {
        haibu.emit('useraccounts:adduser:exit', 'info', {
           exitCode: code
        })
        if (code === 0) {
          _install.call(self, dir, target, changePermissions);
        }
        else {
           callback(new Error('Unable to create user'));
        }
    });

    function changePermissions(err) {
      if (err) {
        callback(err);
        return;
      }

      spawn('chown', ['-R', user + ':nogroup', appdir + '/' + target.name]).on('exit', function (exitCode) {
        haibu.emit('useraccounts:chown:exit', 'info', {
           exitCode: exitCode
        })
        if (exitCode) {
          callback(new Error('Unable to grab ownership for files'));
        }
        else {
          spawn('chmod', ['-R', permissions, appdir]).on('exit', function (exitCode) {
            haibu.emit('useraccounts:chmod:exit', 'info', {
               exitCode: exitCode
            })
            if (exitCode) {
              callback(new Error('Unable to change permissions for files'));
            }
            else {
              callback();
            }
          });
        }
      });
    }
  }
};

useraccounts.init = function (done) {
  done();
};
