const { createServer } = require("node:http");

function listen(prepare) {
  const port = process.env.PORT || 3000;
  let handler;

  const server = createServer((req, res) => {
    if (handler) return handler(req, res);

    res.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "5"
    });
    res.end("KaamGhar is starting. Please try again shortly.");
  });

  server.listen(port, "0.0.0.0", async () => {
    console.log(`Server running on port ${port}`);
    try {
      handler = await prepare();
      console.log("KaamGhar is ready.");
    } catch (error) {
      console.error("Could not start KaamGhar:", error.message);
      process.exit(1);
    }
  });
}

module.exports = listen;
