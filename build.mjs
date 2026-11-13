// Compatibility entrypoint for Cloudflare Workers Builds when the
// connected Git repository uses the repository root as its build directory.
// Actual LeviOS project remains in levios-trading/worker/.
import "./levios-trading/worker/build.mjs";
