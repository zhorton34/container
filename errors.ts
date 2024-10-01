import { z } from "zod";

export enum ContainerErrorType {
    InvalidExtension = "InvalidExtensionError",
    InvalidAlias = "InvalidAliasError",
    InvalidTag = "InvalidTagError",
    InvalidContextualBinding = "InvalidContextualBindingError",
    CircularDependency = "CircularDependencyError",
    UnresolvedDependency = "UnresolvedDependencyError",
    InvalidTypeError = "InvalidTypeError",
    InvalidSchema = "InvalidSchemaError"
}

/**
 * Error thrown when trying to extend a binding that doesn't exist.
 * 
 * @example
 * ```typescript
 * const container = new Container();
 * 
 * class Service {}
 * 
 * // This will throw an InvalidExtensionError
 * container.extend(Service, (original: any) => original);
 * ```
 */
export class InvalidExtensionError extends Error {
    constructor(type: Function | z.ZodType<any> | string) {
      let typeDescription: string;

      if (typeof type === 'function') {
        typeDescription = type.name || 'Anonymous Function';
      } else if (type instanceof z.ZodType) {
        typeDescription = 'ZodSchema';
      } else {
        typeDescription = type;
      }

      super(`No binding found for the given type: ${typeDescription}`);
      this.name = "InvalidExtensionError";
    }
}
  
  /**
   * Error thrown when trying to resolve an alias that doesn't exist.
   * 
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * // This will throw an InvalidAliasError
   * container.make('nonexistent-alias');
   * ```
   */
  export class InvalidAliasError extends Error {
    constructor(alias: string) {
      super(`No alias found for: ${alias}. Make sure you have created this alias using the 'alias' method.`);
      this.name = "InvalidAliasError";
    }
  }
  
  /**
   * Error thrown when trying to resolve a tag that doesn't exist or has no bindings.
   * 
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * // This will throw an InvalidTagError
   * container.tagged('nonexistent-tag');
   * ```
   */
  export class InvalidTagError extends Error {
    constructor(tag: string) {
      super(`No bindings found for tag: '${tag}'. Make sure you have tagged some bindings with this tag using the 'tag' method.`);
      this.name = "InvalidTagError";
    }
  }
  
  /**
   * Error thrown when a contextual binding is invalid or undefined.
   * 
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * class Service {
   *   static paramTypes = ['config'];
   *   constructor(public config: any) {}
   * }
   * 
   * container.when(Service).needs('config').give(undefined as any);
   * 
   * // This will throw an InvalidContextualBindingError
   * container.createInstance(Service);
   * ```
   */
  export class InvalidContextualBindingError extends Error {
    constructor(serviceName: string, dependencyName: string) {
      super(`Invalid contextual binding for ${serviceName}: '${dependencyName}' is undefined. Ensure that you're providing a valid value or factory function for the contextual binding.`);
      this.name = "InvalidContextualBindingError";
    }
  }
  
  /**
   * Error thrown when a circular dependency is detected.
   * 
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * class A {
   *   static paramTypes = [new TypeWrapper(z.unknown(), Symbol('B'))];
   *   constructor(public b: B) {}
   * }
   * 
   * class B {
   *   static paramTypes = [new TypeWrapper(z.unknown(), Symbol('A'))];
   *   constructor(public a: A) {}
   * }
   * 
   * container.register(A);
   * container.register(B);
   * 
   * // This will throw a CircularDependencyError
   * container.createInstance(A);
   * ```
   */
  export class CircularDependencyError extends Error {
    constructor(dependencyChain: string[]) {
      super(`Circular dependency detected: ${dependencyChain.join(" -> ")}. Break the circular dependency by redesigning your classes or using a factory function.`);
      this.name = "CircularDependencyError";
    }
  }
  
  /**
   * Error thrown when trying to resolve a dependency that hasn't been bound to the container.
   * 
   * @example
   * ```typescript
   * const container = new Container();
   * const UnregisteredType = new TypeWrapper(z.unknown(), Symbol('Unregistered'));
   * 
   * // This will throw an UnresolvedDependencyError
   * container.resolve(UnregisteredType);
   * ```
   */
  export class UnresolvedDependencyError extends Error {
    constructor(type: Function | string | symbol | object) {
      let typeName: string;
      if (typeof type === 'function') {
        typeName = type.name || 'Anonymous Function';
      } else if (typeof type === 'symbol') {
        typeName = type.toString();
      } else if (typeof type === 'object') {
        typeName = type.constructor.name || 'Anonymous Object';
      } else {
        typeName = String(type);
      }
      super(`No binding found for the given type: ${typeName}`);
      this.name = "UnresolvedDependencyError";
    }
  }
  
  /**
   * Error thrown when a resolved value doesn't match the expected type.
   * 
   * @example
   * ```typescript
   * const container = new Container();
   * const StringType = new TypeWrapper(z.string(), Symbol('string'));
   * 
   * container.bind(StringType, () => 42 as any);
   * 
   * // This will throw an InvalidTypeError
   * container.resolve(StringType);
   * ```
   */
  export class InvalidTypeError extends Error {
    constructor(expected: string, received: string, details: string) {
      super(`Expected ${expected.toLowerCase()}, received ${received}. ${details}`);
      this.name = "InvalidTypeError";
    }
}

/**
 * Error thrown when a schema is invalid.
 * 
 * @example
 * ```typescript
 * const container = new Container();
 * 
 * const schema = z.object({
 *   name: z.string(),
 *   age: z.number().optional()
 * });
 * 
 * // This will throw an InvalidSchemaError
 * container.bind(schema, () => ({ name: 'John', age: 30 }));
 * ```
 */ 
export class InvalidSchemaError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'InvalidSchemaError';
    }
}
