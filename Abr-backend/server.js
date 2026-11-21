const listen = require("./src/listen");

listen(async () => {
  require("dotenv").config();
  await require("./src/initialize")();
  return require("./src/app");
});
