import { Container, CircularDependencyError } from "../mod.ts";

const container = new Container();

class ServiceA {
  constructor(public serviceB: ServiceB) {}
}

class ServiceB {
  constructor(public serviceA: ServiceA) {}
}

// Circular binding
container.bind(ServiceA, (c: Container) => new ServiceA(c.resolve(ServiceB)));
container.bind(ServiceB, (c: Container) => new ServiceB(c.resolve(ServiceA)));

// Attempting to resolve will throw CircularDependencyError
try {
  container.resolve(ServiceA);
} catch (e) {
  if (e instanceof CircularDependencyError) {
    console.error("Circular dependency detected:", e.message);
  }
}
