# @findhow/container 

> 🚀 Unleash the Power of TypeScript Dependency Injection with @Findhow/Container 🔥


A TypeScript-based Dependency Injection (DI) container with support for various
binding types (singleton, transient, scoped), contextual bindings, middleware,
circular dependency detection, and Zod schema validation for runtime type
safety.

## @Findhow/Container compared

| Feature                              | @findhow/container | Inversify | NestJS    | TypeDI | TSyringe |
| ------------------------------------ | ------------------- | --------- | --------- | ------ | -------- |
| **TypeScript Support**               | ✅                  | ✅        | ✅        | ✅     | ✅       |
| **Does not Need Decorator-based DI** | ✅                  | ❌        | ❌        | ❌     | ❌       |
| **Constructor Injection**            | ✅                  | ✅        | ✅        | ✅     | ✅       |
| **Property Injection**               | ✅                  | ✅        | ✅        | ✅     | ✅       |
| **Method Injection**                 | ✅                  | ✅        | ✅        | ✅     | ✅       |
| **Circular Dependency Detection**    | ✅                  | ✅        | ✅        | ✅     | ✅       |
| **Lazy Injection**                   | ✅                  | ✅        | ✅        | ✅     | ❌       |
| **Named Injections**                 | ✅                  | ✅        | ✅        | ✅     | ✅       |
| **Tagged Injections**                | ✅                  | ✅        | ✅        | ❌     | ❌       |
| **Scoped Injections**                | ✅                  | ✅        | ✅        | ✅     | ✅       |
| **Async Injection**                  | ✅                  | ❌        | ✅        | ✅     | ❌       |
| **Middleware Support**               | ✅                  | ❌        | ✅        | ❌     | ❌       |
| **Zod Schema Validation**            | ✅                  | ❌        | ❌        | ❌     | ❌       |
| **Framework Integration**            | ❌                  | ❌        | ✅ (Full) | ❌     | ❌       |

## Examples

See the [examples](./examples) directory for more usage examples.

| Example                                                                                  | Description                                                                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Circular Dependency Detection](./examples/circular-dependency-detection.ts)             | Demonstrates how to handle circular dependencies in a DI container.                                              |
| [Scoped Binding](./examples/scoped-binding.ts)                                           | Shows how to create scoped instances of services in a DI container.                                              |
| [Middleware](./examples/middleware.ts)                                                   | Illustrates the use of middleware to log dependency resolutions.                                                 |
| [Dependency Injection with Interface](./examples/dependency-injection-with-interface.ts) | Example of binding and resolving services using interfaces for payment processing.                               |
| [Basic Usage](./examples/basic-usage.ts)                                                 | A simple example of creating a DI container and binding a service.                                               |
| [Async Binding](./examples/async-binding.ts)                                             | Demonstrates how to resolve dependencies that require asynchronous initialization.                               |
| [Contextual Bindings](./examples/contextual-bindings.ts)                                 | Shows how to bind different values depending on the context.                                                     |
| [Singleton Binding](./examples/singleton-binding.ts)                                     | Illustrates how to bind a service as a singleton, ensuring a single instance is used throughout the application. |
| [Transient Binding](./examples/transient-binding.ts)                                     | Demonstrates how to bind a service as transient, creating a new instance each time it is resolved.               |

## Features

- **Singleton, Transient, and Scoped Bindings**: Control the lifecycle of your
  services with different binding strategies.
- **Contextual Bindings**: Bind different values depending on the context.
- **Zod Schema Validation**: Validate resolved instances against Zod schemas for
  type safety.
- **Middleware Support**: Intercept and modify resolution logic using
  middleware.
- **Async Bindings**: Resolve dependencies that require asynchronous
  initialization.
- **Circular Dependency Detection**: Prevent infinite loops by detecting
  circular dependencies.
- **Tagging and Aliasing**: Bind services to tags or aliases for more flexible
  resolution.

## Installation

1. Clone the repository or copy the source files into your project.
2. Install the required dependencies:

```bash
deno add @findhow/container
```

## Examples


### Basic Container Binding
> _This example demonstrates how to bind a simple class to the container and resolve it. It's useful for basic dependency injection where you want to decouple your code from direct instantiations._

```ts
import { Container } from "@findhow/container";

class Logger {
  log(message: string) {
    console.log(message);
  }
}

const container = new Container();
container.bind('Logger', () => new Logger());

const logger = container.resolve<Logger>('Logger');
logger.log('Hello, World!'); // Output: Hello, World!
```


### Singleton Binding
> _This example demonstrates how to bind a class as a singleton. This ensures that the same instance is returned every time the service is resolved, useful when you want to maintain shared state._

```ts
import { Container } from "@findhow/container";

class Config {
  constructor(public env: string) {}
}

const container = new Container();
container.singleton('Config', () => new Config('production'));

const config1 = container.resolve<Config>('Config');
const config2 = container.resolve<Config>('Config');

console.log(config1 === config2); // Output: true
```




### Zod Schema Validation on Binding
> _This example shows how to use Zod schema validation when binding a service to ensure that the resolved instance meets the expected schema. This is useful for enforcing runtime type safety._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a Zod schema for the service
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

class UserService {
  constructor(public id: number, public name: string) {}
}

const container = new Container();

// Bind the service and validate it against the Zod schema
container.bind('UserService', () => new UserService(1, 'Alice'), userSchema);

const userService = container.resolve<UserService>('UserService');
console.log(userService); // Output: UserService { id: 1, name: 'Alice' }
```

### Invalid Schema Detection
> _This example demonstrates how the container throws an error if the resolved instance does not conform to the Zod schema, helping catch errors early during service resolution._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a Zod schema for validation
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

class InvalidUserService {
  constructor(public id: string, public name: number) {} // Invalid types
}

const container = new Container();

try {
  // Try binding the invalid service and validate against the schema
  container.bind('InvalidUserService', () => new InvalidUserService('one', 123), userSchema);
  container.resolve<InvalidUserService>('InvalidUserService');
} catch (error) {
  console.error(error.message); 
  // Output: Invalid schema for InvalidUserService: Expected number, received string...
}
```


### Schema Validation with Nested Objects
> _This example shows how Zod can be used to validate more complex services with nested objects, ensuring that the entire structure is type-safe at runtime._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a nested Zod schema
const configSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number(),
  }),
  apiKey: z.string(),
});

class ConfigService {
  constructor(public config: { database: { host: string; port: number }; apiKey: string }) {}
}

const container = new Container();

// Bind the service with schema validation
container.bind('ConfigService', () => new ConfigService({
  database: { host: 'localhost', port: 5432 },
  apiKey: 'abc123',
}), configSchema);

const configService = container.resolve<ConfigService>('ConfigService');
console.log(configService.config.database.host); // Output: localhost
```


### Conditional Schema Validation
> _This example shows how you can use conditional logic inside Zod schemas to handle more dynamic validation scenarios during dependency injection, such as checking optional fields based on other conditions._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a schema with conditional fields
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional(), // Optional field
  role: z.enum(['admin', 'user']),
}).refine(data => data.role === 'admin' ? !!data.email : true, {
  message: "Admin users must have an email",
});

class UserService {
  constructor(public id: number, public name: string, public email?: string, public role: string) {}
}

const container = new Container();

// Bind a user with valid schema (admin with email)
container.bind('UserServiceAdmin', () => new UserService(1, 'Alice', 'alice@example.com', 'admin'), userSchema);

const userServiceAdmin = container.resolve<UserService>('UserServiceAdmin');
console.log(userServiceAdmin); // Output: UserService { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' }

try {
  // Try binding a user without an email for an admin role (invalid)
  container.bind('UserServiceInvalid', () => new UserService(2, 'Bob', undefined, 'admin'), userSchema);
  container.resolve<UserService>('UserServiceInvalid');
} catch (error) {
  console.error(error.message); // Output: Admin users must have an email
}
```


### Async Binding with Zod Schema Validation
> _This example demonstrates how you can use Zod schema validation with asynchronous services, ensuring that even services resolved asynchronously meet the expected type safety criteria._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a Zod schema for validation
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

class UserService {
  constructor(public id: number, public name: string) {}

  static async create() {
    // Simulate async service creation
    return new Promise<UserService>((resolve) => {
      setTimeout(() => resolve(new UserService(1, 'Async Alice')), 1000);
    });
  }
}

const container = new Container();

// Bind the async service and validate against the schema
container.bind('UserService', async () => await UserService.create(), userSchema);

(async () => {
  const userService = await container.resolveAsync<UserService>('UserService');
  console.log(userService); // Output: UserService { id: 1, name: 'Async Alice' }
})();
```

### Contextual Binding with Zod Schema Validation
> _This example shows how Zod schema validation can be combined with contextual bindings, ensuring that each context adheres to the correct schema._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a Zod schema
const configSchema = z.object({
  host: z.string(),
  port: z.number(),
});

class ConfigService {
  constructor(public config: { host: string; port: number }) {}
}

const container = new Container();

// Bind a default config service
container.bind('ConfigService', () => new ConfigService({ host: 'localhost', port: 5432 }), configSchema);

// Contextual binding with different config
container.when('AdminService').needs('ConfigService').give(() => new ConfigService({ host: 'admin-host', port: 3306 }), configSchema);

const defaultConfigService = container.resolve<ConfigService>('ConfigService');
console.log(defaultConfigService.config); // Output: { host: 'localhost', port: 5432 }

const adminConfigService = container.resolve<ConfigService>('ConfigService', 'AdminService');
console.log(adminConfigService.config); // Output: { host: 'admin-host', port: 3306 }
```

### Zod Schema Validation with Bound Object
> _This example demonstrates how Zod schema validation can be used to validate the structure of a bound object in the container. It ensures that the object conforms to the defined schema when resolved._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a Zod schema
const userSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const container = new Container();

// Bind an object that matches the Zod schema
container.bind('User', () => ({ id: 1, name: 'Alice' }), userSchema);

const user = container.resolve('User');
console.log(user); // Output: { id: 1, name: 'Alice' }
```

### Invalid Zod Schema Error
> _This example shows how the container throws an `InvalidSchemaError` when the bound object doesn't conform to the expected Zod schema._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";
import { InvalidSchemaError } from './errors.ts';

// Define a Zod schema
const schema = z.object({ name: z.string() });

const container = new Container();

// Attempt to bind an object that doesn't conform to the schema
try {
  container.bind('InvalidObject', () => ({ name: 123 }), schema);
} catch (error) {
  console.error(error instanceof InvalidSchemaError); // Output: true
  console.error(error.message); // Output: Invalid schema for InvalidObject
}
```

### Async Binding with Zod Schema Validation
> _This example demonstrates how you can bind an asynchronous service and validate it against a Zod schema after it's resolved. It ensures that even async services are validated for type safety._

```ts
import { Container } from "@findhow/container";
import { z } from "zod";

// Define a Zod schema for validation
const serviceSchema = z.object({
  id: z.number(),
  name: z.string(),
});

class AsyncService {
  id = 1;
  name = 'AsyncService';
  async getValue() {
    return this.name;
  }
}

const container = new Container();

// Bind the async service and validate against the schema
container.bind('AsyncService', async () => new AsyncService(), serviceSchema);

(async () => {
  const service = await container.resolveAsync<AsyncService>('AsyncService');
  console.log(await service.getValue()); // Output: AsyncService
})();
```

[Clean Code Studio](https://cleancode.studio)

These examples demonstrate the flexibility of combining Zod schema validation with the `@findhow/container` dependency injection system to ensure runtime safety for both synchronous and asynchronous services. You can enforce validation in various contexts, including conditional logic and nested structures.
