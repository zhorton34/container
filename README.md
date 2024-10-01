# @Findhow/Container (Dependency Injection (DI) Container)

A TypeScript-based Dependency Injection (DI) container with support for various
binding types (singleton, transient, scoped), contextual bindings, middleware,
circular dependency detection, and Zod schema validation for runtime type
safety.

## @Findhow/Container Comparison to other Popular DI Containers

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
deno add @findhow/zod
deno add @findhow/container
```

## Getting Started

### Basic Usage

#### 1. Create a DI Container

First, create a new instance of the container:

```typescript
import { DIContainer } from "@findhow/dicontainer.ts";

const container = new DIContainer();
```

#### 2. Bind a Class to the Container

You can bind a class or a factory function to the container. Here's an example
of binding a class to a container:

```typescript
class Service {
  getValue() {
    return "Hello, DI!";
  }
}

container.bind(Service, () => new Service());
```

#### 3. Resolve the Class from the Container

Once you've bound a class, you can resolve it:

```typescript
const service = container.resolve(Service);
console.log(service.getValue()); // Output: Hello, DI!
```

### Binding Types

#### 1. Singleton Binding

A singleton binding ensures that only one instance of the class is created and
shared throughout the application.

```typescript
class SingletonService {
  value = Math.random();
}

container.singleton(SingletonService, () => new SingletonService());

const instance1 = container.resolve(SingletonService);
const instance2 = container.resolve(SingletonService);

console.log(instance1 === instance2); // Output: true
```

#### 2. Transient Binding

A transient binding creates a new instance of the class every time it's
resolved.

```typescript
class TransientService {
  value = Math.random();
}

container.transient(TransientService, () => new TransientService());

const instance1 = container.resolve(TransientService);
const instance2 = container.resolve(TransientService);

console.log(instance1 === instance2); // Output: false
```

#### 3. Scoped Binding

A scoped binding provides the same instance within a specific scope but
different instances across different scopes.

```typescript
class ScopedService {
  value = Math.random();
}

container.scoped(ScopedService, () => new ScopedService());

const scope1 = container.createScope();
const scope2 = container.createScope();

const instance1 = scope1.resolve(ScopedService);
const instance2 = scope2.resolve(ScopedService);

console.log(instance1 === instance2); // Output: false
```

### Contextual Bindings

Contextual bindings allow you to inject different dependencies based on the
context in which a service is resolved.

```typescript
container.bind("config", () => ({ env: "production" }));
container.when("Service").needs("config").give(() => ({ env: "development" }));

class Service {
  constructor(public config: any) {}
}

container.bind(
  Service,
  (c: DIContainer) => new Service(c.resolve("config", "Service")),
);

const service = container.resolve(Service);
console.log(service.config.env); // Output: development
```

### Zod Schema Validation

Zod integration allows you to validate resolved instances against schemas at
runtime.

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
});

container.bind(UserSchema, () => ({ id: 1, name: "John Doe" }));

const user = container.resolve(UserSchema);
console.log(user); // Output: { id: 1, name: 'John Doe' }
```

If an instance does not conform to the schema, an `InvalidSchemaError` will be
thrown:

```typescript
assertThrows(
  () => {
    container.bind(UserSchema, () => ({ id: 1, name: 123 })); // Invalid data
  },
  InvalidSchemaError,
  "Invalid schema for UserSchema",
);
```

### Middleware

Middlewares allow you to intercept and modify the resolution process:

```typescript
container.use((next) => {
  console.log("Resolving a dependency");
  return next();
});

class MiddlewareService {
  getValue() {
    return "Middleware Example";
  }
}

container.bind(MiddlewareService, () => new MiddlewareService());
const service = container.resolve(MiddlewareService); // Logs: 'Resolving a dependency'
```

### Async Bindings

You can bind asynchronous services to the container and resolve them using
`resolveAsync`.

```typescript
class AsyncService {
  async getValue() {
    return "Async Value";
  }
}

container.bind(AsyncService, async () => {
  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
  return new AsyncService();
});

const service = await container.resolveAsync(AsyncService);
console.log(await service.getValue()); // Output: Async Value
```

### Circular Dependency Detection

The container detects circular dependencies and throws a
`CircularDependencyError`.

```typescript
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
  "Circular dependency detected",
);
```

### Tagging and Aliasing

Tagging allows you to bind multiple services to a tag and resolve them as a
group:

```typescript
class ReportA {
  generate() {
    return "Report A";
  }
}

class ReportB {
  generate() {
    return "Report B";
  }
}

container.bind(ReportA, () => new ReportA());
container.bind(ReportB, () => new ReportB());
container.tag([ReportA, ReportB], "reports");

const reports = container.tagged("reports");
reports.forEach((report) => console.log(report.generate()));
// Output: 'Report A', 'Report B'
```

Aliasing allows you to resolve the same service with different identifiers:

```typescript
container.bind("Logger", () => ({ log: () => console.log("Logging...") }));
container.alias("Log", "Logger");

const logger = container.resolve("Log");
logger.log(); // Output: 'Logging...'
```

## Error Handling

The container provides detailed error messages and custom error classes to help
diagnose issues:

- `InvalidExtensionError`: Thrown when trying to extend a binding that doesn't
  exist.
- `InvalidAliasError`: Thrown when trying to resolve an alias that doesn't
  exist.
- `InvalidTagError`: Thrown when resolving a tag with no bindings.
- `InvalidContextualBindingError`: Thrown when a contextual binding is invalid
  or undefined.
- `CircularDependencyError`: Thrown when circular dependencies are detected.
- `UnresolvedDependencyError`: Thrown when trying to resolve a dependency that
  hasn't been bound to the container.
- `InvalidTypeError`: Thrown when the resolved value doesn't match the expected
  type.
- `InvalidSchemaError`: Thrown when a resolved instance doesn't match the Zod
  schema.

## Advanced Usage

### Optional Dependencies

You can gracefully handle optional dependencies by catching errors during
resolution:

```typescript
class Service {
  constructor(public optionalDependency?: any) {}
}

container.bind(Service, (c: DIContainer) => {
  let optionalDep;
  try {
    optionalDep = c.resolve("OptionalDep");
  } catch (e) {
    optionalDep = null;
  }
  return new Service(optionalDep);
});

const service = container.resolve(Service);
console.log(service.optionalDependency); // Output: null
```

### Property Injection

You can inject dependencies into class properties manually:

```typescript
class Dependency {
  getValue() {
    return "Injected Value";
  }
}

class Service {
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
console.log(service.getServiceValue()); // Output: 'Injected Value'
```

## Conclusion

This DI container provides a flexible and feature-rich solution for managing
dependencies in TypeScript applications. With support for various binding types,
contextual bindings, middleware, and Zod schema validation, it offers powerful
tools for building scalable and maintainable applications.
