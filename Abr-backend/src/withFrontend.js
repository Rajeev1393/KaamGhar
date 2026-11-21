const path = require("node:path");

async function withFrontend(dir) {
  const next = require(require.resolve("next", { paths: [dir] }));
  const frontend = next({ dev: false, dir });
  const render = frontend.getRequestHandler();
  await Promise.all([frontend.prepare(), require("./initialize")()]);
  const api = require("./app");

  return (req, res) => {
    const pathname = req.url.split("?", 1)[0];
    if (/^\/api(?:\/|$)/i.test(pathname) && !/^\/api\/location\/reverse\/?$/i.test(pathname)) {
      return api(req, res);
    }
    return render(req, res);
  };
}

module.exports = withFrontend;
