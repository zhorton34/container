import { Container } from "../mod.ts";

const container = new Container();

// Middleware to log every dependency resolution
container.use((next) => {
  console.log("Resolving dependency...");
  return next();
});

class LoggerService {
  log(message: string) {
    console.log("Log:", message);
  }
}

// Bind the LoggerService
container.bind(LoggerService, () => new LoggerService());

// Resolve the LoggerService (middleware will log)
const logger = container.resolve(LoggerService);
logger.log("Middleware Test"); // Output: "Resolving dependency..." followed by "Log: Middleware Test"
