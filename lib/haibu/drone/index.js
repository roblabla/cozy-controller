/*
 * index.js: Top-level include for the drone module.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    flatiron = require('flatiron'),
    haibu = require('../../haibu'),
    Client = require("request-json").JsonClient
    async = haibu.common.async;

//
// ### Include Exports
// Export other components in the module
//
exports.Drone   = require('./drone').Drone;
exports.Client  = require('haibu-api').Client;
exports.started = false;
clientDS = new Client('http://localhost:9101')
//
// ### function autostart (server, callback)
// #### @server {http.Server} Haibu drone server to autostart drones with.
// #### @callback {function} Continuation to respond to when complete
// Autostarts drones for all applications persisted to
// `haibu.config.get('directories:autostart')`.
//
exports.autostart = function (server, callback) {
  var stop = false
  var autostartDir = haibu.config.get('directories:autostart');

  //
  // Helper function which starts multiple drones
  // a given application.
  //
  function startDrones (pkg, done) {
    if (pkg.drones == 0) {
      return done();
    }

    var started = 0;

    async.whilst(function () {
      return started < pkg.drones;
    }, function (next) {
      started++;
      server.drone.start(pkg, next);
    }, done);
  }

  new_drones = []

  function checkDatabase(drones, files, cb) {
    if (drones.length != 0) {
      app =drones.pop()
      if (app.name != 'proxy' && app.name != 'home') {
        if (fs.statSync(files[app.name]).mode != 33216){  
          fs.chmodSync(files[app.name], 0700);
        }
        if (haibu.config.get('authToken')){
          token = haibu.config.get('authToken')
        } else {
          token = ""
        }
        clientDS.setBasicAuth('home', token) 
        clientDS.post('/request/application/all/', {}, function(err, res, body) {
          findApp = false
          if (res.statusCode != 200 || err){
            new_drones.push(app)
            checkDatabase(drones, files, cb)            
          } else {
            for (i in body){
              appli = body[i]
              if (appli.value.name.toLowerCase() == app.name.toLowerCase()) {             
                doc = appli
                findApp = true
              }
            }
            if (!findApp) {
              // File is not in database
              //fs.unlink(files[app.name])
              checkDatabase(drones, files, cb)
            } else {
              doc = doc.value
              if (doc.state != 'installed') {
                // File is not installed
                fs.unlink(files[app.name])
                checkDatabase(drones, files, cb)
              } else if (doc.password != app.password) {
                // Password is not the same than in database
                app.password = doc.password
                data = JSON.stringify(app)
                fd = fs.openSync(files[app.name],'r+');
                fs.writeSync(fd, data, 0, data.length, 0) 
                new_drones.push(app)
                checkDatabase(drones, files, cb)
              } else {
                // Everything is ok 
                new_drones.push(app)
                checkDatabase(drones, files, cb)
              }
            }
          }
        })
      } else {
        // Application is home or proxy
        new_drones.push(app)  
        checkDatabase(drones, files, cb)       
      }
    } else {
      cb(new_drones)
    }
  }

  dataSytemExist = false
  endDS = false
  dronesFiles = {}
  function startDataSystem (files, drones, cb) {
    if (files.length != 0) {
      file = files.pop()
      fs.readFile(path.join(autostartDir, file), function (err, pkg) {
        if (err) {
          return cb(err);
        }
        try {
          pkg = JSON.parse(pkg.toString());
        }
        catch (ex) {
          return cb(ex);
        }
        if (pkg.name == 'data-system') {
          // If file corresponds to data-system, spawn data-system
          dataSytemExist = true
          haibu.emit('autostart:start:data-system', 'info')
          startDrones(pkg, function() {
            startDataSystem(files, drones, cb)
          });
        } else {
          // If file correspond to another application, pkkg is stored in drones
          drones.push(pkg)
          dronesFiles[pkg.name] = path.join(autostartDir, file)
          startDataSystem(files, drones, cb);
        }
      })
    } else {
      if (dataSytemExist) {
        // Configure DS timeout
        if (haibu.config.get('timeout-ds')){
          timeoutDS = haibu.config.get('timeout-ds')
        } else {
          timeoutDS = 300000
        } 
        setTimeout(function(){
          if (!endDS) {
            // Data system is broken : controller doesn't start other applications
            endDS = true
            haibu.emit('autostart:stop:data-system', 'info')
            cb([])
          }
        }, timeoutDS)
        checkApps(['data-system'], function(){
          if (!endDS){
            endDS = true   
            // Synchronize pkg and database for all applications
            checkDatabase(drones, dronesFiles, function(drones){
              haibu.emit('autostart:end:data-system', 'info')
              cb(drones);              
            })     
          }
        });
      } else {
        // Data system doesn't exist : controller doesn't start other applications
        haibu.emit('autostart:stop:data-system', 'info')
        cb([]);
      }
    }
  }

  // Chech application app
  function check (app, cb) {
    haibu.emit('autostart:checkApp', 'info', {
        app : app
     })
    setTimeout(function() {
      if (!stop) {
        if (!haibu.server.drone.apps[app]){
          check(app, cb)
        } else {
          cb(null);
        }
      }
    }, 3000)
  }


  // Check all applications started
  function checkApps (apps, cb){
    if (apps.length != 0) {
      app = apps.pop()
      check(app, function(){
        checkApps(apps, cb);
      })
    } else {
      cb(null);
    }
  }

  function startApps (files) {
    homePkg = null
    end = false
    apps= []
    startDataSystem(files, [], function(drones){

      haibu.emit('autostart:start:apps', 'info', {
        drones: drones
      })
      // Configure timeout home
      if (haibu.config.get('timeout-home')){
        timeoutHome = haibu.config.get('timeout-home')
      } else {
        timeoutHome = 900000
      }
      setTimeout(function(){
        if (!end) {
          end = true
          stop = true
          if (homePkg) {
            haibu.emit('autostart:timeout:home', 'info')
            startDrones(homePkg, callback);
          } else {
            callback()
          }
        }
      }, timeoutHome)
      async.map(drones, function (pkg, next) {
        //
        // Read each `package.json` manifest file and start
        // the appropriate drones in this `haibu` instance.
        //
        if (pkg.name == "home") {
          homePkg = pkg
          next()
        } else {
          apps.push(pkg.name)
          startDrones(pkg, next);
        }
      }, function(err, result) {
        checkApps(apps, function() {
          if (!end){
            end = true
            if (homePkg) {
              haibu.emit('autostart:start:home', 'info')
              startDrones(homePkg, callback);
            } else {
              callback()
            }
          }
        });
      });
    });
  }

  //
  // Find all drones in directory:
  //   %dir/%sanitized_name.json
  //
  fs.readdir(autostartDir, function (err, files) {
    if (err) {
      return callback(err);
    }
    startApps(files)
  });
}

//
// ### function start (options, callback)
// #### @options {Object} Options to use when starting this module.
// #### @callback {function} Continuation to respond to when complete.
// Starts the haibu `drone` webservice with the specified options.
//
exports.start = function (options, callback) {
  if (exports.started) {
    return callback(null, haibu.running.server);
  }
  haibu.emit('server:start', 'info')
  function tryAutostart (server) {
    exports.autostart(server, function (err) {
      //
      // Ignore errors from autostart and continue
      // bringing up the haibu `drone` server.
      //
      // Remark: We should report the `err` somewhere
      //
      haibu.emit('start');
      callback(null, server);
    });
  }

  function startServer (err) {
    if (err) {
      return callback(err);
    }

    //
    // Create the server and add the new `http.Server`
    // and `haibu.drone.Drone` instance into the `haibu.running`
    // namespace.
    //
    var drone = new haibu.drone.Drone(options);

    //
    // Setup the `union` server through `flatiron.plugins.http`
    // and then add routes.
    //
    haibu.use(flatiron.plugins.http, options.http || {});
    require('./service').createRouter(drone);

    if (options.port) {
      haibu.listen(options.port, "127.0.0.1");
    }

    haibu.running.server = haibu.server;
    haibu.running.drone  = haibu.server.drone = drone;
    haibu.running.ports  = {};

    //
    // There is a current bug in node that throws here:
    //
    // https://github.com/joyent/node/blob/v0.4.12/lib/net.js#L159
    //
    // It will throw a broken pipe error (EPIPE) when a child process that you
    // are piping to unexpectedly exits. The write function on line 159 is
    // defined here:
    //
    // https://github.com/joyent/node/blob/v0.4.12/lib/net.js#L62
    //
    // This uncaughtExceptionHandler will catch that error,
    // and since it originated with in another sync context,
    // this section will still respond to the request.
    //
    haibu.plugins.exceptions.logger.exitOnError =  false

    //
    // Attempt to autostart any applications and respond.
    //
    tryAutostart(haibu.server);
  }

  //
  // Indicate that `haibu.drone` has started
  //
  exports.started = true;

  return haibu.initialized
    ? startServer()
    : haibu.init(options, startServer);
};

//
// ### function stop (callback)
// #### @cleanup {bool} (optional) Remove all autostart files (default=true).
// #### @callback {function} Continuation to respond to when complete.
// Gracefully stops `drone` instance
//
exports.stop = function (cleanup, callback) {
  if (!callback && typeof cleanup === 'function') {
    callback = cleanup;
    cleanup = true;
  }

  if (!exports.started) {
    return callback ? callback() : null;
  }

  exports.started = false;
  haibu.running.server.close();

  // Terminate drones
  haibu.running.drone.destroy(cleanup, callback || function () {});
  haibu.running = {};
};
