import {
  assertEquals,
  assertThrows,
} from '@std/assert';
import { z } from 'zod';
import { Container, Observer } from './container.ts';
import { 
  InvalidSchemaError, 
  UnresolvedDependencyError,
  CircularDependencyError
} from './errors.ts';

class ScopedService {
  value = Math.random();
}

Deno.test('Container - Basic Binding', () => {
  const container = new Container();

  class NumberWrapper {
    constructor(public value: number) {}
  }

  class StringWrapper {
    constructor(public value: string) {}
  }

  container.bind(NumberWrapper, () => new NumberWrapper(42));
  container.bind(StringWrapper, () => new StringWrapper('Hello, Deno!'));

  assertEquals(container.resolve(NumberWrapper).value, 42);
  assertEquals(container.resolve(StringWrapper).value, 'Hello, Deno!');
});

Deno.test('Container - Singleton Binding', () => {
  const container = new Container();

  class SingletonService {
    value = Math.random();
  }

  container.singleton('SingletonService', () => new SingletonService());

  const instance1 = container.resolve<SingletonService>('SingletonService');
  const instance2 = container.resolve<SingletonService>('SingletonService');
  assertEquals(instance1.value, instance2.value);
});

Deno.test('Container - Contextual Binding', () => {
  const container = new Container();

  container.bind("config", () => ({ env: "default" }));
  container.when("Service").needs("config").give(() => ({ env: "local" }));

  container.bind("Service", (c: Container) => {
    const config = c.resolve<{ env: string }>("config", "Service");
    return { config };
  });

  const service = container.resolve<{ config: { env: string } }>("Service");
  assertEquals(service.config.env, "local");
});

Deno.test('Container - Binding Interfaces to Implementations', () => {
  const container = new Container();

  interface EventPusher {
    push(event: string): void;
  }

  class RedisEventPusher implements EventPusher {
    push(event: string): void {
      console.log(`Pushing event to Redis: ${event}`);
    }
  }

  container.bind('EventPusher', () => new RedisEventPusher());

  const pusher = container.resolve<EventPusher>('EventPusher');
  assertEquals(pusher instanceof RedisEventPusher, true);
});

Deno.test('Container - Aliasing', () => {
  const container = new Container();

  container.bind("Logger", () => ({ log: () => {} }));
  container.alias("Log", "Logger");

  const logger = container.resolve("Log");
  assertEquals(typeof logger.log, "function");
});

Deno.test('Container - Tagging', () => {
  const container = new Container();

  class PDFReport {
    generate() {
      return 'PDF Report';
    }
  }

  class CSVReport {
    generate() {
      return 'CSV Report';
    }
  }

  container.bind('PDFReport', () => new PDFReport());
  container.bind('CSVReport', () => new CSVReport());
  container.tag(['PDFReport', 'CSVReport'], 'reports');

  const reports = container.tagged('reports');
  assertEquals(reports.length, 2);
  assertEquals(reports[0].generate(), 'PDF Report');
  assertEquals(reports[1].generate(), 'CSV Report');
});

Deno.test('Container - Detailed Error for Unresolvable Dependency', () => {
  const container = new Container();

  assertThrows(
    () => container.resolve('Unregistered'),
    UnresolvedDependencyError,
    'No binding found for the given type: Unregistered',
  );
});

Deno.test.ignore('Container - Circular Dependency Detection', () => {
  const container = new Container();

  class A {
    constructor(public b: B) {}
    getFromB() {
      return this.b.getName();
    }
    getName() {
      return 'A';
    }
  }

  class B {
    constructor(public a: A) {}
    getFromA() {
      return this.a.getName();
    }
    getName() {
      return 'B';
    }
  }

  container.bind(A, (c: Container) => new A(c.resolve(B)));
  container.bind(B, (c: Container) => new B(c.resolve(A)));

  const a = container.resolve(A);
  const b = container.resolve(B);

  assertEquals((a.b as any).isCircularDependency, true);
  assertEquals((b.a as any).isCircularDependency, true);
  assertEquals(a.getFromB(), 'B');
  assertEquals(b.getFromA(), 'A');
});

Deno.test('Container - Binding Zod Schemas', () => {
  const container = new Container();

  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
  });

  container.bind(UserSchema, () => ({ id: 1, name: 'John Doe' }));

  const user = container.resolve(UserSchema);
  assertEquals(user, { id: 1, name: 'John Doe' });
});

Deno.test('Container - Detailed Error for Invalid Zod Schema', () => {
  const container = new Container();
  const schema = z.object({ name: z.string() });

  assertThrows(
    () => {
      container.bind("InvalidObject", () => ({ name: 123 }), schema);
    },
    InvalidSchemaError,
    "Invalid schema for InvalidObject"
  );
});

Deno.test('Container - Async Binding', async () => {
  const container = new Container();

  class AsyncService {
    async getValue() {
      return 'Async Value';
    }
  }

  container.bind(AsyncService, async () => {
    // Simulate asynchronous initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
    return new AsyncService();
  });

  const service = await container.resolveAsync(AsyncService);
  const value = await service.getValue();

  assertEquals(value, 'Async Value');
});

Deno.test('Container - Transient Binding', () => {
  const container = new Container();

  class TransientService {
    value = Math.random();
  }

  container.transient('TransientService', () => new TransientService());

  const instance1 = container.resolve<TransientService>('TransientService');
  const instance2 = container.resolve<TransientService>('TransientService');
  assertNotEquals(instance1.value, instance2.value);
});

Deno.test('Container - Scoped Binding', () => {
  const container = new Container();

  container.scoped(ScopedService, () => new ScopedService());

  const instance1 = container.resolve(ScopedService);
  const instance2 = container.resolve(ScopedService);

  assertEquals(instance1, instance2);
});

Deno.test('Container - Optional Dependency', () => {
  const container = new Container();

  class Service {
    constructor(public optionalDependency?: any) {}
  }

  container.bind(Service, (c: Container) => {
    let optionalDep;
    try {
      optionalDep = c.resolve('OptionalDep');
    } catch (e) {
      optionalDep = null;
    }
    return new Service(optionalDep);
  });

  const service = container.resolve(Service);
  assertEquals(service.optionalDependency, null);
});

Deno.test('Container - Nested Dependencies', () => {
  const container = new Container();

  class Database {
    query() {
      return 'data';
    }
  }

  class Repository {
    constructor(public db: Database) {}
    getData() {
      return this.db.query();
    }
  }

  class Service {
    constructor(public repo: Repository) {}
    fetchData() {
      return this.repo.getData();
    }
  }

  container.bind(Database, () => new Database());
  container.bind(Repository, (c: Container) => new Repository(c.resolve(Database)));
  container.bind(Service, (c: Container) => new Service(c.resolve(Repository)));

  const service = container.resolve(Service);
  assertEquals(service.fetchData(), 'data');
});

Deno.test('Container - Property Injection', () => {
  const container = new Container();

  class Dependency {
    getValue() {
      return 'injected value';
    }
  }

  class Service {
    // Property to be injected
    dependency!: Dependency;

    getServiceValue() {
      return this.dependency.getValue();
    }
  }

  container.bind(Dependency, () => new Dependency());
  container.bind(Service, (c: Container) => {
    const service = new Service();
    service.dependency = c.resolve(Dependency);
    return service;
  });

  const service = container.resolve(Service);
  assertEquals(service.getServiceValue(), 'injected value');
});

Deno.test('Container - Error for Unregistered Nested Dependency', () => {
  const container = new Container();

  class Dependency {}

  class Service {
    constructor(public dep: Dependency) {}
  }

  container.bind(Service, (c: Container) => new Service(c.resolve(Dependency)));

  assertThrows(
    () => container.resolve(Service),
    UnresolvedDependencyError,
    'No binding found for the given type: Dependency',
  );
});

Deno.test('Container - Resolving Using Symbol Identifiers', () => {
  const container = new Container();

  const SYMBOL_KEY = Symbol('SymbolKey');

  class SymbolService {
    getValue() {
      return 'Symbol Service';
    }
  }

  container.bind(SYMBOL_KEY, () => new SymbolService());

  const service = container.resolve<SymbolService>(SYMBOL_KEY);
  assertEquals(service.getValue(), 'Symbol Service');
});

Deno.test('Container - Dependency Disposal', () => {
  const container = new Container();
  let disposed = false;

  class DisposableService {
    dispose() {
      disposed = true;
    }
  }

  container.singleton(DisposableService, () => new DisposableService());
  const service = container.resolve(DisposableService);

  container.dispose();

  assertEquals(disposed, true);
});

Deno.test('Container - Multiple Implementations', () => {
  const container = new Container();

  interface PaymentProcessor {
    process(amount: number): string;
  }

  class PayPalProcessor implements PaymentProcessor {
    process(amount: number): string {
      return `Processed $${amount} with PayPal`;
    }
  }

  class StripeProcessor implements PaymentProcessor {
    process(amount: number): string {
      return `Processed $${amount} with Stripe`;
    }
  }

  container.bind('PaymentProcessor', () => new PayPalProcessor());
  container.bind('PaymentProcessor_Stripe', () => new StripeProcessor());

  const paypal = container.resolve<PaymentProcessor>('PaymentProcessor');
  const stripe = container.resolve<PaymentProcessor>('PaymentProcessor_Stripe');

  assertEquals(paypal.process(100), 'Processed $100 with PayPal');
  assertEquals(stripe.process(200), 'Processed $200 with Stripe');
});

Deno.test('Container - Observer Pattern', () => {
  const container = new Container();
  const observer = new Observer();
  const events: string[] = [];

  container.instance(Observer, observer);

  observer.subscribe("testEvent", (data: string) => {
    events.push(data);
  });

  observer.publish("testEvent", "Event 1");
  observer.publish("testEvent", "Event 2");

  assertEquals(events, ["Event 1", "Event 2"]);
});

function assertNotEquals(actual: any, expected: any, msg?: string): void {
  if (actual === expected) {
    throw new Error(msg || `Expected ${actual} to not equal ${expected}`);
  }
}

Deno.test('Container - Property Injection with Multiple Dependencies', () => {
  const container = new Container();

  class Logger {
    log(message: string) {
      return `Logged: ${message}`;
    }
  }

  class Database {
    query() {
      return 'Data from DB';
    }
  }

  class Service {
    logger!: Logger;
    database!: Database;

    performOperation() {
      const data = this.database.query();
      return this.logger.log(data);
    }
  }

  container.bind(Logger, () => new Logger());
  container.bind(Database, () => new Database());
  container.bind(Service, (c: Container) => {
    const service = new Service();
    service.logger = c.resolve(Logger);
    service.database = c.resolve(Database);
    return service;
  });

  const service = container.resolve(Service);
  assertEquals(service.performOperation(), 'Logged: Data from DB');
});

Deno.test('Container - Property Injection with Interfaces', () => {
  const container = new Container();

  interface ILogger {
    log(message: string): string;
  }

  class ConsoleLogger implements ILogger {
    log(message: string) {
      return `Console: ${message}`;
    }
  }

  class Service {
    logger!: ILogger;

    logMessage(message: string) {
      return this.logger.log(message);
    }
  }

  container.bind('ILogger', () => new ConsoleLogger());
  container.bind(Service, (c: Container) => {
    const service = new Service();
    service.logger = c.resolve('ILogger');
    return service;
  });

  const service = container.resolve(Service);
  assertEquals(service.logMessage('Test'), 'Console: Test');
});

Deno.test.ignore('Container - Property Injection with Circular Dependencies', () => {
  const container = new Container();

  class ServiceA {
    serviceB!: ServiceB;

    getFromB() {
      return this.serviceB.getName();
    }

    getName() {
      return 'ServiceA';
    }
  }

  class ServiceB {
    serviceA!: ServiceA;

    getFromA() {
      return this.serviceA.getName();
    }

    getName() {
      return 'ServiceB';
    }
  }

  container.bind(ServiceA, (c: Container) => {
    const serviceA = new ServiceA();
    serviceA.serviceB = c.resolve(ServiceB);
    return serviceA;
  });

  container.bind(ServiceB, (c: Container) => {
    const serviceB = new ServiceB();
    serviceB.serviceA = c.resolve(ServiceA);
    return serviceB;
  });

  const serviceA = container.resolve(ServiceA);
  const serviceB = container.resolve(ServiceB);

  assertEquals((serviceA.serviceB as any).isCircularDependency, true);
  assertEquals((serviceB.serviceA as any).isCircularDependency, true);
  assertEquals(serviceA.getFromB(), 'ServiceB');
  assertEquals(serviceB.getFromA(), 'ServiceA');
});

Deno.test('Container - Property Injection with Optional Dependencies', () => {
  const container = new Container();

  class OptionalDependency {
    getValue() {
      return 'Optional Value';
    }
  }

  class Service {
    optionalDep?: OptionalDependency;

    getOptionalValue() {
      return this.optionalDep ? this.optionalDep.getValue() : 'No optional dependency';
    }
  }

  container.bind(Service, (c: Container) => {
    const service = new Service();
    try {
      service.optionalDep = c.resolve<OptionalDependency>(OptionalDependency);
    } catch {
      // Optional dependency not found, leave it undefined
    }
    return service;
  });

  const serviceWithoutOptional = container.resolve(Service);
  assertEquals(serviceWithoutOptional.getOptionalValue(), 'No optional dependency');

  container.bind(OptionalDependency, () => new OptionalDependency());
  const serviceWithOptional = container.resolve(Service);
  assertEquals(serviceWithOptional.getOptionalValue(), 'Optional Value');
});