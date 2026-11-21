const path = require("node:path");
const listen = require("./Abr-backend/src/listen");

process.env.NODE_ENV ||= "production";

listen(async () => {
  require("./Abr-backend/node_modules/dotenv").config({ path: path.join(__dirname, "Abr-backend", ".env") });
  return require("./Abr-backend/src/withFrontend")(path.join(__dirname, "Abr-frontend"));
});
