/*
 * log.js: Simple utilities for logging.
 *
 */

var haibu = require('../../haibu');


exports.initLog = function() {

  //
  // Log common information
  //
  var evNames = [ 'git:clone', 'git:pull', 'npm:install:load',
    'npm:install:start', 'drone:stop','drone:cleanAll:success',
    'repo:dir:user:create'];
  evNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name);
    });
  });

  // 
  // Log autostart
  //
  var autoStartNames = ['drone:start','repo:dir:exists', 'autostart:checkApp',
      'autostart:start:data-system'];
  autoStartNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      if (meta != undefined && meta.app != undefined){
        console.log(message + ": " + name + ":" + meta.app);
      } else {
        console.log(message + ": " + name)
      }
    });
  });
  var timeout = ['autostart:timeout:home'];
  timeout.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log("Timeout : Start home".yellow)
    })
  })
  var startApps = ['autostart:start:apps'];
  startApps.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      drones = ""
      meta.drones.forEach(function (app) {
        drones = drones + app.name + ", " 
      })
      console.log(message + ": " + name + '\n ' + drones)
    })
  })
  var endDS = ['autostart:end:data-system'];
  endDS.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name)
      console.log("Data System is started, now others apps can start".green)
    })
  })
  var noDS = ['autostart:stop:data-system'];
  noDS.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name)
      console.log("Data System is not started, others apps cannot be started".red)
    })
  })
  var startHome = ['autostart:start:home'];
  startHome.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name)
      console.log("All applications (except home) are started, now home can start".green)
    })
  })


  //
  // Log stdout
  //
  var stdoutNames = ['brunch:build'];
  stdoutNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name + '  ' + meta.stdout); });
  });

  //
  // Log errors
  //
  var errNames = ['error:service' , 'error', 'drone:clean:warning',
    'npm:install:failure','brunch:build:failure', 'drone:cleanAll:warning',
    'git:clone:error']
  errNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message.red.bold + ": "+ name.red.bold + ": \n" +
        JSON.stringify(meta) + "\n"); });
  });

  var restart = ['drone:restart'];
  restart.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name.red + ": " + meta.pkg.name)
    })
  })

  //
  // Log starts functions
  //
  var startNames = ['action:start', 'action:stop', 'action:brunch:build',
    'action:light:update','action:clean', 'action:cleanAll, action:restart',
    'action:update']
  startNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      datetime = new Date();
      console.log("[" + datetime + "]\n" +
        name.bold + ": " + meta.app.bold + "\n" + ">>> perform");
    });
  });

  //
  // Log succeded functions
  //
  var succNames = [ 'brunch:build:success', 'cleanAll:success',
  'start:success', 'stop:success', "restart:success", 'update:success',
  'light:update:success','clean:success'];
  succNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(name.green.bold + ": " + meta.app + "\n" + "<<< perform\n");
    });
  });
}