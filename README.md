# [Cozy](http://cozy.io) Controller

The Cozy Controller is used to fetch and manage the applications in the Cozy
Platform. 

The Cozy Controller is a clone of [Haibu](https://github.com/nodejitsu/haibu)
by [Nodejistu](https://www.nodejitsu.com/) augmented with features required by
the Cozy use cases, like:

* configurable application directory
* configurable application file permissions
* applications are started in a given order.
* Update application without loading a full reinstallation process.

You can specify options in file configuration located at:

    /etc/cozy/cozy-controller.conf

Options available :

* npm-registry: registry used for npm
* strict-ssl: option strict-ssl for npm
* timeout-autostart-home: maximum time between applications starting and home starting during autostart
* timeout-autostart-ds: time to consider data-system broken during autostart


If you want further details, check out the 
[wiki](https://github.com/mycozycloud/cozy-controller/wiki) or 
[Haibu original documentation](https://github.com/nodejitsu/haibu/blob/master/README.md)


## Install

Installation:

    npm install cozy-controller -g

Start:

    cozy-controller --jh

Run following command to see all available actions:

    cozy-controller --help

## Contribution

You can contribute to the Cozy Controller in many ways:

* Pick up an [issue](https://github.com/mycozycloud/cozy-controller/issues?state=open) and solve it.
* Add support for Python applications.
* Add support for serverless applications.

## Hack

First you have to create two folders:

    mdkir /etc/cozy
    chown myuser: /etc/cozy
    mkdir ~/cozy-apps/

Then you can fetch sources and run the controller locally.

    git clone https://github.com/mycozycloud/cozy-controller.git
    cd cozy-controller
    chmod +x ./bin/cozy-controller
    ./bin/cozy-controller --dir ~/cozy-apps


## Tests

![Build
Status](https://travis-ci.org/mycozycloud/cozy-controller.png?branch=master)

To run tests type the following command into the Cozy Home folder:

    npm test

## License

Cozy Controller is developed by Cozy Cloud and distributed under the AGPL v3
license.

## What is Cozy?

![Cozy Logo](https://raw.github.com/mycozycloud/cozy-setup/gh-pages/assets/images/happycloud.png)

[Cozy](http://cozy.io) is a platform that brings all your web services in the
same private space.  With it, your web apps and your devices can share data
easily, providing you with a new experience. You can install Cozy on your own
hardware where no one profiles you. 

## Community 

You can reach the Cozy Community by:

* Chatting with us on IRC #cozycloud on irc.freenode.net
* Posting on our [Forum](https://groups.google.com/forum/?fromgroups#!forum/cozy-cloud)
* Posting issues on the [Github repos](https://github.com/mycozycloud/)
* Mentioning us on [Twitter](http://twitter.com/mycozycloud)

