const listen = require("./src/listen");
const { existsSync } = require("node:fs");
const path = require("node:path");

listen(async () => {
  require("dotenv").config();
  const frontend = path.join(__dirname, "hosted-frontend");
  if (existsSync(path.join(frontend, ".next", "BUILD_ID"))) {
    return require("./src/withFrontend")(frontend);
  }
  await require("./src/initialize")();
  return require("./src/app");
});
