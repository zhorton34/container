import { DIContainer } from "../../mod.ts";

const container = new DIContainer();

container.bind("logger", () => {
  return {
    log: (message: string) => console.log(message),
  };
});

container.bind("service", (c: DIContainer) => {
  return {
    log: (message: string) => c.resolve("logger").log(message),
  };
});

const service: { log: (message: string) => void } = container.resolve("service");
service.log("Hello, world!");

container.resolve("service");
class LoggerService {
  info(message: string) {
    console.log(message);
  }
  error(message: string) {
    console.error(message);
  }

  warn(message: string) {
    console.warn(message);
  }

  debug(message: string) {
    console.debug(message);
  }
}

container.bind(LoggerService, () => new LoggerService());
container.resolve(LoggerService).info("Hello, World");