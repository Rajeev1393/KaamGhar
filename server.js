const path = require("node:path");
const listen = require("./Abr-backend/src/listen");

process.env.NODE_ENV ||= "production";

listen(async () => {
  require("./Abr-backend/node_modules/dotenv").config({ path: path.join(__dirname, "Abr-backend", ".env") });
  const next = require("./Abr-frontend/node_modules/next");
  const initialize = require("./Abr-backend/src/initialize");
  const frontend = next({ dev: false, dir: path.join(__dirname, "Abr-frontend") });
  const render = frontend.getRequestHandler();

  await Promise.all([frontend.prepare(), initialize()]);
  const api = require("./Abr-backend/src/app");

  return (req, res) => {
    const pathname = req.url.split("?", 1)[0];
    if (/^\/api(?:\/|$)/i.test(pathname) && !/^\/api\/location\/reverse\/?$/i.test(pathname)) {
      return api(req, res);
    }
    return render(req, res);
  };
});
