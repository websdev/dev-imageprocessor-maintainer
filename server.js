//setup Dependencies
var express = require('express'),
	morgan = require('morgan'),
	bodyParser = require('body-parser'),
	methodOverride = require('method-override'),
	path = require('path'),
	fs = require('fs'),
	childProc = require('child_process'),
	port = (process.env.PORT || 8081)

//Setup Express
var server = express();

var staticDir = path.join(__dirname, 'static')

console.log('using dirname: ' + staticDir);
server.use(express.static(staticDir));
server.use(morgan('dev'));
server.use(bodyParser());
server.use(methodOverride());

// Error handler
server.use(function (err, req, res, next) {
	console.log('error occurred');
	console.error(err.stack);
	if (err instanceof NotFound) {
		res.sendfile(path.join(staticDir, '404.html'));
	} else {
		res.sendfile(path.join(staticDir, '500.html'));
	}
});

server.listen(port);

///////////////////////////////////////////
//              Routes                   //
///////////////////////////////////////////


server.route('/')
	.get(function (req, res) {
		res.sendfile(path.join(staticDir, 'index.html'));
	})
	.post(function (req, res) {
		res.sendfile(path.join(staticDir, 'index.html'));
	});

var updateIP = function (req, res) {
	var ip = req.connection.remoteAddress;
	var siteNames = req.param('siteNames');
	console.log('received request with payload, IP: "' + ip + '", Site Names: "' + siteNames + '"');

	if (typeof siteNames === typeof undefined) {
		res.redirect('/');
	}
	else {
		try {
			//synchronously process data in here - only want to open the file once!
			var data = fs.readFileSync('/etc/hosts');
			var siteNameArr = siteNames.split(',');
			for(var i = 0; i < siteNameArr.length; i++) {
				var siteName = siteNameArr[i];
				console.log("processing site Name: '" + siteName + '"');

				if(siteName.indexOf('localhost') > -1 || siteName.indexOf('devwebsimageprocessor201') > -1
					|| siteName.indexOf('ip6-') > -1) {
					res.json(500, { "Error" : "Invalid site name" })
					return;
				}

				var regexp = new RegExp('(\\d{1,3}\\.?){4}\\s+' + siteName, 'ig');
				if(regexp.exec(data)) {
					data = new String(data).replace(regexp, ip + '\t' + siteName); // replace 1st match group with new IP
					fs.writeFileSync('/etc/hosts', data);
				}
				else {
					fs.appendFileSync('/etc/hosts', '\n' + ip + '\t' + siteName);
				}
			}

			//restart DNSMasq
			var dnsmasq = childProc.exec('/etc/init.d/dnsmasq restart',
				function (error, stdout, stderr) {
					console.log('stdout: ' + stdout);

					var match = stdout.match(/\.\.\.done\./g);

					if (error !== null ) {
						console.log('exec error: ' + error);
						res.json(500, { "Error" : error.stack} );
					} else {
						//expect 3 "...done." blocks
						if(!match || match.length < 2) {
							console.log('did not receive 3 OKs for dnsmasq restart:\n' + stdout);
							res.json(500, { "Error" : "DNSMasq restart not successful" } );
						} else {
							res.send(200, 'OK');
						}
					}
				});
		}
		catch(err) {
			res.json(500, { "Error" : err.stack } );
		}
	}
}

server.route('/updateIP')
	.get(updateIP)
	.post(updateIP);

//The 404 Route
server.get('/*', function (req, res) {
	res.sendfile(path.join(staticDir, '404.html'));
});

function NotFound(msg) {
	this.name = 'NotFound';
	Error.call(this, msg);
	Error.captureStackTrace(this, arguments.callee);
}


console.log('Listening on http://0.0.0.0:' + port);
