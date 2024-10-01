import {
  assertEquals,
  assertThrows,
} from '@std/assert';
import { z } from 'zod';
import { DIContainer, Observer } from './dicontainer.ts';
import { 
  InvalidSchemaError, 
  UnresolvedDependencyError,
  CircularDependencyError
} from './errors.ts';

class ScopedService {
  value = Math.random();
}

Deno.test('Container - Basic Binding', () => {
  const container = new DIContainer();

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
  const container = new DIContainer();

  class SingletonService {
    value = Math.random();
  }

  container.singleton('SingletonService', () => new SingletonService());

  const instance1 = container.resolve<SingletonService>('SingletonService');
  const instance2 = container.resolve<SingletonService>('SingletonService');
  assertEquals(instance1.value, instance2.value);
});

Deno.test('Container - Contextual Binding', () => {
  const container = new DIContainer();

  container.bind("config", () => ({ env: "default" }));
  container.when("Service").needs("config").give(() => ({ env: "local" }));

  container.bind("Service", (c: DIContainer) => {
    const config = c.resolve<{ env: string }>("config", "Service");
    return { config };
  });

  const service = container.resolve<{ config: { env: string } }>("Service");
  assertEquals(service.config.env, "local");
});

Deno.test('Container - Binding Interfaces to Implementations', () => {
  const container = new DIContainer();

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
  const container = new DIContainer();

  container.bind("Logger", () => ({ log: () => {} }));
  container.alias("Log", "Logger");

  const logger = container.resolve("Log");
  assertEquals(typeof logger.log, "function");
});

Deno.test('Container - Tagging', () => {
  const container = new DIContainer();

  interface Report {
    generate(): string;
  }

  class PDFReport implements Report {
    generate() {
      return 'PDF Report';
    }
  }

  class CSVReport implements Report {
    generate() {
      return 'CSV Report';
    }
  }

  container.bind(PDFReport, () => new PDFReport());
  container.bind(CSVReport, () => new CSVReport());

  container.tag([PDFReport, CSVReport], 'reports');

  const reports = container.tagged('reports') as Report[];
  assertEquals(reports.length, 2);
  assertEquals(reports[0].generate(), 'PDF Report');
  assertEquals(reports[1].generate(), 'CSV Report');
});

Deno.test('Container - Detailed Error for Unresolvable Dependency', () => {
  const container = new DIContainer();

  assertThrows(
    () => container.resolve('Unregistered'),
    UnresolvedDependencyError,
    'No binding found for the given type: Unregistered',
  );
});

Deno.test('Container - Circular Dependency Detection', () => {
  const container = new DIContainer();

  class A {
    constructor(public b: B) {}
  }

  class B {
    constructor(public a: A) {}
  }

  container.bind(A, (c: DIContainer) => new A(c.resolve(B)));
  container.bind(B, (c: DIContainer) => new B(c.resolve(A)));

  assertThrows(
    () => container.resolve(A),
    CircularDependencyError,
    'Circular dependency detected',
  );
});

Deno.test('Container - Binding Zod Schemas', () => {
  const container = new DIContainer();

  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
  });

  container.bind(UserSchema, () => ({ id: 1, name: 'John Doe' }));

  const user = container.resolve(UserSchema);
  assertEquals(user, { id: 1, name: 'John Doe' });
});

Deno.test('Container - Detailed Error for Invalid Zod Schema', () => {
  const container = new DIContainer();
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
  const container = new DIContainer();

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
  const container = new DIContainer();

  class TransientService {
    value = Math.random();
  }

  container.transient('TransientService', () => new TransientService());

  const instance1 = container.resolve<TransientService>('TransientService');
  const instance2 = container.resolve<TransientService>('TransientService');
  assertNotEquals(instance1.value, instance2.value);
});

Deno.test('Container - Scoped Binding', () => {
  const container = new DIContainer();

  container.scoped(ScopedService, () => new ScopedService());

  const instance1 = container.resolve(ScopedService);
  const instance2 = container.resolve(ScopedService);

  assertEquals(instance1, instance2);
});

Deno.test('Container - Optional Dependency', () => {
  const container = new DIContainer();

  class Service {
    constructor(public optionalDependency?: any) {}
  }

  container.bind(Service, (c: DIContainer) => {
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
  const container = new DIContainer();

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
  container.bind(Repository, (c: DIContainer) => new Repository(c.resolve(Database)));
  container.bind(Service, (c: DIContainer) => new Service(c.resolve(Repository)));

  const service = container.resolve(Service);
  assertEquals(service.fetchData(), 'data');
});

Deno.test('Container - Property Injection', () => {
  const container = new DIContainer();

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
  container.bind(Service, (c: DIContainer) => {
    const service = new Service();
    service.dependency = c.resolve(Dependency);
    return service;
  });

  const service = container.resolve(Service);
  assertEquals(service.getServiceValue(), 'injected value');
});

Deno.test('Container - Error for Unregistered Nested Dependency', () => {
  const container = new DIContainer();

  class Dependency {}

  class Service {
    constructor(public dep: Dependency) {}
  }

  container.bind(Service, (c: DIContainer) => new Service(c.resolve(Dependency)));

  assertThrows(
    () => container.resolve(Service),
    UnresolvedDependencyError,
    'No binding found for the given type: Dependency',
  );
});

Deno.test('Container - Resolving Using Symbol Identifiers', () => {
  const container = new DIContainer();

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
  const container = new DIContainer();
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
  const container = new DIContainer();

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
  const container = new DIContainer();
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