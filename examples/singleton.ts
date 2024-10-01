import { DIContainer } from "../mod.ts";

const container = new DIContainer();

class ConfigService {
  private config = { app: "MyApp", version: "1.0.0" };

  getConfig() {
    return this.config;
  }
}

// Bind as a singleton
container.singleton(ConfigService, () => new ConfigService());

const instance1 = container.resolve(ConfigService);
const instance2 = container.resolve(ConfigService);

console.log(instance1 === instance2); // Output: true
console.log(instance1.getConfig()); // Output: { app: "MyApp", version: "1.0.0" }
