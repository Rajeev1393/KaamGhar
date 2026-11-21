const path = require("node:path");

process.env.NODE_ENV ||= "production";
require("./Abr-backend/node_modules/dotenv").config({ path: path.join(__dirname, "Abr-backend", ".env") });

const next = require("./Abr-frontend/node_modules/next");
const api = require("./Abr-backend/src/app");
const start = require("./Abr-backend/server");

const frontend = next({ dev: false, dir: path.join(__dirname, "Abr-frontend") });
const render = frontend.getRequestHandler();

frontend.prepare()
  .then(() => start((req, res) => {
    const pathname = req.url.split("?", 1)[0];
    if (/^\/api(?:\/|$)/i.test(pathname) && !/^\/api\/location\/reverse\/?$/i.test(pathname)) {
      return api(req, res);
    }
    return render(req, res);
  }))
  .catch((error) => {
    console.error("Could not start KaamGhar:", error.message);
    process.exit(1);
  });
