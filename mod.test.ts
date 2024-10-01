import { Container, Bindable } from "./mod.ts";
import { assertEquals, assertThrows } from "@std/assert"
import { z } from "zod";
import {
    InvalidExtensionError,
    InvalidAliasError,
    InvalidTagError,
    InvalidContextualBindingError,
    CircularDependencyError,
    UnresolvedDependencyError,
    InvalidTypeError
} from "./errors.ts";
import { delay } from "@std/async";

let container: Container;

// Setup hook
Deno.test({
  name: "setup",
  fn: () => {
    console.log("Setting up tests...");
    container = new Container();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// Teardown hook
Deno.test({
  name: "teardown",
  fn: () => {
    console.log("Tearing down tests...");
    // Perform any cleanup if necessary
    container = undefined as any;
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

const beforeEach = async (t: Deno.TestContext) => {
  console.log(`Setting up for test: ${t.name}`);
  container = new Container();
};

const afterEach = async (t: Deno.TestContext) => {
  console.log(`Cleaning up after test: ${t.name}`);
  container = undefined as any;
};

Deno.test("Container - Basic Binding", async (test) => {
  await beforeEach(test);
  
  class NumberWrapper {
    constructor(public value: number) {}
  }
  class StringWrapper {
    constructor(public value: string) {}
  }

  // Simple Bindings
  container.bind(NumberWrapper, () => new NumberWrapper(42));
  container.bind(StringWrapper, () => new StringWrapper("Hello, Deno!"));

  assertEquals((container.resolve(NumberWrapper) as NumberWrapper).value, 42);
  assertEquals((container.resolve(StringWrapper) as StringWrapper).value, "Hello, Deno!");

  // Singleton Binding
  class Singleton {
    constructor(public value: number) {}
  }
  container.bindSingleton(Singleton, () => new Singleton(Math.random()));

  const instance1 = container.resolve(Singleton);
  const instance2 = container.resolve(Singleton);
  assertEquals(instance1, instance2);

  await afterEach(test);
});

Deno.test("Container - Binding Interfaces to Implementations", () => {
    const container = new Container();

    interface EventPusher {
        push(event: string): void;
    }

    class RedisEventPusher implements EventPusher {
        push(event: string): void {
            console.log(`Pushing event to Redis: ${event}`);
        }
    }

    container.bind(RedisEventPusher, () => new RedisEventPusher());

    const pusher = container.resolve(RedisEventPusher) as RedisEventPusher;
    assertEquals(pusher instanceof RedisEventPusher, true);
});

Deno.test("Container - Contextual Binding", () => {
    const container = new Container();

    class FilesystemType {
      constructor(public value: string) {}
    }

    class PhotoController {
        static paramTypes = [FilesystemType];
        constructor(public filesystem: FilesystemType) {}
    }

    class VideoController {
        static paramTypes = [FilesystemType];
        constructor(public filesystem: FilesystemType) {}
    }

    container.bind(FilesystemType, () => new FilesystemType("default"));

    container.when(PhotoController).needs(FilesystemType).give(() => new FilesystemType("local"));
    container.when(VideoController).needs(FilesystemType).give(() => new FilesystemType("s3"));

    const photoController = container.createInstance(PhotoController);
    const videoController = container.createInstance(VideoController);

    assertEquals(photoController.filesystem.value, "local");
    assertEquals(videoController.filesystem.value, "s3");
});

Deno.test("Container - Binding Primitives", () => {
    const container = new Container();

    class UserController {
        static paramTypes = ['maxUsers'];
        constructor(public maxUsers: number) {}
    }

    container.when(UserController).needs('maxUsers').give(100);

    const userController = container.createInstance(UserController);
    assertEquals(userController.maxUsers, 100);
});

Deno.test("Container - Extending Bindings", () => {
    const container = new Container();

    class Service {
        getName(): string {
            return "Original Service";
        }
    }

    class DecoratedService {
        constructor(private service: Service) {}

        getName(): string {
            return `Decorated: ${this.service.getName()}`;
        }
    }

    container.bind(Service, () => new Service());

    container.extend(Service, (service: Service) => new DecoratedService(service));

    const resolvedService = container.resolve(Service) as DecoratedService;
    assertEquals(resolvedService.getName(), "Decorated: Original Service");
});

Deno.test("Container - Automatic Injection", () => {
    const container = new Container();

    class Database {
        getName(): string {
            return "MySQL";
        }
    }

    class UserRepository {
        static paramTypes = [Database];
        constructor(private db: Database) {}

        getDbName(): string {
            return this.db.getName();
        }
    }

    container.bind(Database, () => new Database());

    const repo = container.createInstance(UserRepository);
    assertEquals(repo.getDbName(), "MySQL");
});

Deno.test("Container - Aliasing", () => {
    const container = new Container();

    interface Logger {
        log(message: string): void;
    }

    class FileLogger implements Logger {
        log(message: string) {
            console.log(`File: ${message}`);
        }
    }

    container.bind(FileLogger, () => new FileLogger());
    container.alias('logger', FileLogger);

    const logger = container.make('logger') as Logger;
    assertEquals(logger instanceof FileLogger, true);
});

Deno.test("Container - Binding Instances", () => {
    const container = new Container();

    class Config {
        constructor(public data: Record<string, any>) {}
    }

    const configInstance = new Config({ app_name: 'MyApp' });
    container.instance(Config, configInstance);

    const resolvedConfig = container.resolve(Config);
    assertEquals(resolvedConfig, configInstance);
});

Deno.test("Container - Tagging", () => {
    const container = new Container();

    interface Report {
        generate(): string;
    }

    class PDFReport implements Report {
        generate() { return 'PDF Report'; }
    }

    class CSVReport implements Report {
        generate() { return 'CSV Report'; }
    }

    container.bind(PDFReport, () => new PDFReport());
    container.bind(CSVReport, () => new CSVReport());

    container.tag([PDFReport, CSVReport], 'reports');

    const reports = container.tagged('reports') as Report[];
    assertEquals(reports.length, 2);
    assertEquals(reports[0].generate(), 'PDF Report');
    assertEquals(reports[1].generate(), 'CSV Report');
});

Deno.test("Container - Contextual Binding with Interfaces", () => {
    const container = new Container();

    interface PaymentGateway {
        process(amount: number): string;
    }

    class StripeGateway implements PaymentGateway {
        process(amount: number) { return `Stripe: $${amount}`; }
    }

    class PayPalGateway implements PaymentGateway {
        process(amount: number) { return `PayPal: $${amount}`; }
    }

    class OrderProcessor {
        static paramTypes = [StripeGateway];
        constructor(private gateway: PaymentGateway) {}
        processOrder(amount: number) { return this.gateway.process(amount); }
    }

    container.bind(StripeGateway, () => new StripeGateway());
    container.when(OrderProcessor).needs(StripeGateway).give(() => new StripeGateway());

    const processor = container.createInstance(OrderProcessor);
    assertEquals(processor.processOrder(100), 'Stripe: $100');
});

Deno.test("Container - Method Invocation", () => {
    const container = new Container();

    class UserService {
        getUser() { return { id: 1, name: 'John' }; }
    }

    class PostService {
        constructor(private userService: UserService) {}
        getPostsForUser(userId: number) { return [`Post for user ${userId}`]; }
    }

    container.bind(UserService, () => new UserService());

    const result = container.call([PostService, 'getPostsForUser'], [1]);
    assertEquals(result, ['Post for user 1']);
});

Deno.test.ignore("Container - Binding Typed Variadics", () => {
  const container = new Container();

  class Filter {
    constructor(public name: string) {}
  }

  class Firewall {
    static paramTypes = [[Filter]];
    constructor(private filters: Filter[]) {}
    getFilterNames() {
      return this.filters.map(f => f.name);
    }
  }

  // Bind individual filters
  container.bind(Filter, () => new Filter('NullFilter'));
  container.bind(Filter, () => new Filter('ProfanityFilter'));
  container.bind(Filter, () => new Filter('TooLongFilter'));

  // Register Firewall with the container
  container.register(Firewall, Firewall.paramTypes as (Bindable | Bindable[])[]);

  const firewall = container.createInstance(Firewall);
  assertEquals(firewall.getFilterNames().sort(), ["NullFilter", "ProfanityFilter", "TooLongFilter"].sort());
});

Deno.test("Container - Detailed Error for Unresolvable Dependency", () => {
    const container = new Container();
  
    assertThrows(
      () => container.resolve("Unregistered"),
      UnresolvedDependencyError,
      "No binding found for the given type: Unregistered"
    );
  });
  
  Deno.test("Container - Detailed Error for Invalid Type in Binding", () => {
    const container = new Container();
  
    const stringSchema = z.string();
    container.bind(stringSchema, () => 42 as any);
  
    assertThrows(
      () => container.resolve(stringSchema),
      z.ZodError,
      "Expected string, received number"
    );
  });
  
  Deno.test("Container - Circular Dependency Detection", () => {
    const container = new Container();
  
    class A {
      static paramTypes = [() => B];
      constructor(public b: B) {}
    }
  
    class B {
      static paramTypes = [() => A];
      constructor(public a: A) {}
    }
  
    container.bind(A, () => new A(container.resolve(B)));
    container.bind(B, () => new B(container.resolve(A)));
  
    assertThrows(
      () => {
        container.register(A);
        container.register(B);
        container.createInstance(A);
      },
      CircularDependencyError,
      "Circular dependency detected: A -> B -> A"
    );
  });
  
  
    
  Deno.test("Container - Detailed Error for Invalid Contextual Binding", () => {
    const container = new Container();
  
    class Service {
      static paramTypes = ['config'];
      constructor(public config: any) {}
    }
  
    container.when(Service).needs('config').give(() => undefined);
  
    assertThrows(
      () => container.createInstance(Service),
      InvalidContextualBindingError,
      "Invalid contextual binding for Service: 'config' is undefined"
    );
  });
  
  Deno.test("Container - Detailed Error for Invalid Alias", () => {
    const container = new Container();
  
    assertThrows(
      () => container.make('nonexistent-alias'),
      InvalidAliasError,
      "No alias found for: nonexistent-alias"
    );
  });
  
  Deno.test("Container - Detailed Error for Invalid Extension", () => {
    const container = new Container();

    class Service {}
  
    assertThrows(
      () => container.extend(Service, (original: any) => original),
      InvalidExtensionError,
      "No binding found for the given type: Service"
    );
  });

Deno.test("Container - Binding Zod Schemas", () => {
  const container = new Container();

  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
  });

  container.bind(UserSchema, () => ({ id: 1, name: "John Doe" }));

  const user = container.resolve(UserSchema);
  assertEquals(user, { id: 1, name: "John Doe" });
});

Deno.test("Container - Binding Functions", () => {
  const container = new Container();

  const greet = (name: string) => `Hello, ${name}!`;

  container.bind(greet, () => (name: string) => `Greetings, ${name}!`);

  const greetFn = container.resolve(greet) as (name: string) => string;
  assertEquals(greetFn("Alice"), "Greetings, Alice!");
});

Deno.test("Container - Binding Strings", () => {
  const container = new Container();

  container.bind("config", () => ({ apiKey: "secret" }));

  const config = container.resolve("config");
  assertEquals(config, { apiKey: "secret" });
});

Deno.test("Container - Detailed Error for Invalid Zod Schema", () => {
  const container = new Container();

  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string().email(),
    age: z.number().min(18),
  });

  class InvalidUser {
    id = "1";  // should be number
    name = 123;  // should be string
    email = "invalid-email";  // should be valid email
    age = 15;  // should be at least 18
  }

  container.bind(UserSchema, () => new InvalidUser());

  assertThrows(
    () => container.resolve(UserSchema),
    z.ZodError,
    "invalid_type"
  );
});

Deno.test("Container - Zod Schema in paramTypes", () => {
  const container = new Container();

  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
  });

  class UserService {
    static paramTypes = [UserSchema];
    constructor(public user: z.infer<typeof UserSchema>) {}
  }

  container.bind(UserSchema, () => ({ id: 1, name: "John Doe" }));
  container.register(UserService, UserService.paramTypes);

  const userService = container.createInstance(UserService);
  assertEquals(userService.user, { id: 1, name: "John Doe" });

  // Test with invalid data
  container.bind(UserSchema, () => ({ id: "1", name: 123 } as any));
  assertThrows(
    () => container.createInstance(UserService),
    z.ZodError,
    "Expected number, received string"
  );
});

Deno.test("Container - Binding and Resolving Async Functions", async () => {
  const container = new Container();

  const asyncFunction = async () => {
    await delay(100);
    return "Async result";
  };

  container.bind("asyncFunc", () => asyncFunction);

  const resolvedFunc = container.resolve<() => Promise<string>>("asyncFunc");
  const result = await resolvedFunc();

  assertEquals(result, "Async result");
});

Deno.test("Container - Async Dependencies", async () => {
  const container = new Container();

  const asyncDependency = async () => {
    await delay(100);
    return "Async Dependency";
  };

  class AsyncService {
    constructor(private dependency: () => Promise<string>) {}

    async getMessage() {
      const dep = await this.dependency();
      return `Service with ${dep}`;
    }
  }

  container.bind("asyncDep", () => asyncDependency);
  container.bind(AsyncService, () => new AsyncService(container.resolve("asyncDep")));

  const service = container.resolve<AsyncService>(AsyncService);
  const message = await service.getMessage();
  assertEquals(message, "Service with Async Dependency");
});

Deno.test("Container - Resolving Multiple Async Dependencies", async () => {
  const container = new Container();

  const asyncDep1 = async () => {
    await delay(100);
    return "Dep1";
  };

  const asyncDep2 = async () => {
    await delay(50);
    return "Dep2";
  };

  container.bind("asyncDep1", () => asyncDep1);
  container.bind("asyncDep2", () => asyncDep2);

  const resolveMultiple = async () => {
    const [result1, result2] = await Promise.all([
      container.resolve<() => Promise<string>>("asyncDep1")(),
      container.resolve<() => Promise<string>>("asyncDep2")(),
    ]);
    return `${result1} ${result2}`;
  };

  container.bind("multipleAsyncDeps", () => resolveMultiple);

  const resolvedFunc = container.resolve<() => Promise<string>>("multipleAsyncDeps");
  const result = await resolvedFunc();
  assertEquals(result, "Dep1 Dep2");
});

Deno.test("Container - Dynamic Custom Error Handling", () => {
  const container = new Container();

  const GeoDetailsSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
  });

  const AddressSchema = z.object({
    geo: GeoDetailsSchema.optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    zip: z.string().regex(/^\d{5}$/).optional(),
  });

  const ProfileSchema = z.object({
    age: z.number().int().optional(),
    email: z.string().email(),
    address: AddressSchema,
  });

  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    profile: ProfileSchema,
  });

  container.bind(UserSchema, () => ({
    id: 1,
    name: "Alice",
    profile: {
      age: "not a number",
      email: "invalid-email",
      address: { zip: "invalid", geo: { latitude: "not a number", longitude: "not a number" } },
    },
  }));

  let geoErrorCalled = false;
  let addressErrorCalled = false;
  let profileErrorCalled = false;
  let userErrorCalled = false;

  container.bindCustomError(GeoDetailsSchema, () => { 
    geoErrorCalled = true;
    console.log("GeoDetails error handler called.");
  });

  container.bindCustomError(AddressSchema, () => { 
    addressErrorCalled = true;
    console.log("Address error handler called.");
  });
  container.bindCustomError(ProfileSchema, () => { 
    profileErrorCalled = true;
    console.log("Profile error handler called.");
  });
  container.bindCustomError(UserSchema, () => { 
    userErrorCalled = true;
    console.log("User error handler called.");
  });

  assertThrows(
    () => container.resolve(UserSchema),
    z.ZodError,
    '"expected": "number"'
  );

  assertEquals(geoErrorCalled, true, "GeoDetails error handler should be called");
  assertEquals(addressErrorCalled, true, "Address error handler should be called");
  assertEquals(profileErrorCalled, true, "Profile error handler should be called");
  assertEquals(userErrorCalled, true, "User error handler should be called");
});





Deno.test("Container - callWithDynamicSchema", () => {
  const container = new Container();

  const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
  });

  function processUser(user: z.infer<typeof UserSchema>) {
    return `Processed user: ${user.name}`;
  }

  const result = container.callWithDynamicSchema(processUser, { id: 1, name: "Alice" }, UserSchema);
  assertEquals(result, "Processed user: Alice");

  assertThrows(
    () => container.callWithDynamicSchema(processUser, { id: 1, name: 123 } as any, UserSchema),
    z.ZodError,
    "Expected string, received number"
  );
});
