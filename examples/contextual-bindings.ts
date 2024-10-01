import { DIContainer } from "../mod.ts";

const container = new DIContainer();

// Bind the default config
container.bind("config", () => ({ env: "production" }));

// Bind a different config based on the service context
container.when("service").needs("config").give(() => ({ env: "development" }));

class Service {
  constructor(public config: { env: string }) {}

  logEnv() {
    console.log(`Environment: ${this.config.env}`);
  }
}

// Bind the service
container.bind(Service, (c: DIContainer) => new Service(c.resolve("config", "service")));

// Resolve the service and log the environment
const service = container.resolve(Service);
service.logEnv(); // Output: Environment: development
