import { Container } from "../mod.ts";

const container = new Container();

class ScopedService {
  value = Math.random();
}

// Bind as a scoped service
container.scoped(ScopedService, () => new ScopedService());

const scope1 = container.createScope();
const scope2 = container.createScope();

const instance1 = scope1.resolve(ScopedService);
const instance2 = scope2.resolve(ScopedService);

console.log(instance1 !== instance2); // Output: true (different instances in different scopes)
