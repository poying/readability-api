var qs = require('qs');
var url = require('phantom-url');
var webpage = require('webpage');
var webserver = require('webserver');
var urlencode = require('urlencode');
var system = require('system');
var args = system.args;

if (args.length !== 2) {
  console.log('Usage: phantomjs server.js <port>');
  phantom.exit(1);
}

startServer(args[1]);

function startServer(port) {
  server = webserver.create();
  var service = server.listen(port, requestHandler);

  if (!service) {
    console.log('FAIL to start web server');
    phantom.exit(1);
  } else {
    console.log('http://localhost:' + port);
  }
}

function requestHandler(req, res) {
  var parsedUrl = url(req.url);
  var query = parsedUrl.search ? qs.parse(parsedUrl.search.substr(1)) : {};
  var fetchUrl = query.fetch_url;

  if (!fetchUrl) {
    end(res, 400, { message: 'No URL requested.' });
    return;
  }

  fetchUrl = urlencode.decode(fetchUrl);

  if (!/^https?:\/\//.test(fetchUrl)) {
    end(res, 400, { message: 'Requested URL has a non-supported protocol, use http or https.' });
    return;
  }

  fetch(fetchUrl, function (err, article) {
    if (err) {
      end(res, 500, { message: err.message });
      return;
    }
    end(res, 200, { article: article });
  });
}

function end(res, status, data) {
  var body = JSON.stringify({
    success: status === 200,
    data: data
  });
  res.setHeader('content-type', 'application/json');
  res.statusCode = status;
  res.write(body);
  res.close();
}

function fetch(url, cb) {
  var page = webpage.create();

  page.onError = function () {};

  page.open(url, function (status) {
    if (status !== 'success') {
      cb(new Error('FAIL to load the address'));
      return;
    }

    if (!page.injectJs('node_modules/readability/Readability.js')) {
      cb(new Error('FAIL to include Readability.js'));
      return;
    }

    var article = page.evaluate(function () {
      var location = document.location;
      var uri = {
        spec: location.href,
        host: location.host,
        prePath: location.protocol + "//" + location.host,
        scheme: location.protocol.substr(0, location.protocol.indexOf(":")),
        pathBase: location.protocol + "//" + location.host + location.pathname.substr(0, location.pathname.lastIndexOf("/") + 1)
      };
      var article = new Readability(uri, document).parse();
      return {
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        length: article.length
      };
    });

    cb(null, article);

    page.close();
  });
}
