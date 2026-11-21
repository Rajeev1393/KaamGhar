const { execFileSync } = require("node:child_process");
const { cpSync, existsSync, mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const backend = path.resolve(__dirname, "..");
const destination = path.join(backend, "hosted-frontend");
let source = path.resolve(backend, "..", "Abr-frontend");
let checkout;

try {
  if (!existsSync(path.join(source, "package-lock.json"))) {
    checkout = mkdtempSync(path.join(os.tmpdir(), "kaamghar-source-"));
    execFileSync("git", ["clone", "--depth", "1", "--branch", "main", "https://github.com/Rajeev1393/KaamGhar.git", checkout], { stdio: "inherit" });
    source = path.join(checkout, "Abr-frontend");
  }

  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, {
    recursive: true,
    filter: (file) => {
      const name = path.basename(file);
      return !["node_modules", ".next", ".git"].includes(name) &&
        !name.startsWith(".env") && !name.endsWith(".tsbuildinfo");
    }
  });
  const options = { cwd: destination, stdio: "inherit" };
  execFileSync(process.execPath, [process.env.npm_execpath, "ci", "--include=dev"], options);
  execFileSync(process.execPath, [process.env.npm_execpath, "run", "build"], options);
} finally {
  if (checkout) rmSync(checkout, { recursive: true, force: true });
}
