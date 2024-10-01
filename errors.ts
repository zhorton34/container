import { z } from "zod";

/**
 * Enum representing the different types of errors that can occur within the container.
 * Each error type corresponds to a specific issue that may arise during dependency resolution.
 */
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
 * Error thrown when an attempt is made to extend a binding that does not exist.
 * This error indicates that the specified type has not been registered in the container.
 */
export class InvalidExtensionError extends Error {
    /**
     * Creates an instance of InvalidExtensionError.
     * @param type - The type that was attempted to be extended. This can be a function, a Zod schema, or a string.
     */
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
 * Error thrown when an alias is resolved that does not exist.
 * This error indicates that the specified alias has not been created in the container.
 */
export class InvalidAliasError extends Error {
    /**
     * Creates an instance of InvalidAliasError.
     * @param alias - The alias that was attempted to be resolved.
     */
    constructor(alias: string) {
      super(`No alias found for: ${alias}. Make sure you have created this alias using the 'alias' method.`);
      this.name = "InvalidAliasError";
    }
}

/**
 * Error thrown when a tag is resolved that has no associated bindings.
 * This error indicates that the specified tag has not been used to tag any bindings in the container.
 */
export class InvalidTagError extends Error {
    /**
     * Creates an instance of InvalidTagError.
     * @param tag - The tag that was attempted to be resolved.
     */
    constructor(tag: string) {
      super(`No bindings found for tag: '${tag}'. Make sure you have tagged some bindings with this tag using the 'tag' method.`);
      this.name = "InvalidTagError";
    }
}

/**
 * Error thrown when a contextual binding is invalid or undefined.
 * This error indicates that the specified service or dependency is not properly defined.
 */
export class InvalidContextualBindingError extends Error {
    /**
     * Creates an instance of InvalidContextualBindingError.
     * @param serviceName - The name of the service for which the contextual binding is invalid.
     * @param dependencyName - The name of the dependency that is undefined.
     */
    constructor(serviceName: string, dependencyName: string) {
      super(`Invalid contextual binding for ${serviceName}: '${dependencyName}' is undefined. Ensure that you're providing a valid value or factory function for the contextual binding.`);
      this.name = "InvalidContextualBindingError";
    }
}

/**
 * Error thrown when a circular dependency is detected.
 * This error indicates that the dependency resolution process has encountered a loop.
 */
export class CircularDependencyError extends Error {
    /**
     * Creates an instance of CircularDependencyError.
     * @param dependencyChain - An array representing the chain of dependencies that led to the circular reference.
     */
    constructor(dependencyChain: string[]) {
      super(`Circular dependency detected: ${dependencyChain.join(" -> ")}. Break the circular dependency by redesigning your classes or using a factory function.`);
      this.name = "CircularDependencyError";
    }
}

/**
 * Error thrown when a dependency cannot be resolved because it has not been bound.
 * This error indicates that the specified type has not been registered in the container.
 */
export class UnresolvedDependencyError extends Error {
    /**
     * Creates an instance of UnresolvedDependencyError.
     * @param type - The type that could not be resolved. This can be a function, string, symbol, or object.
     */
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
 * Error thrown when the resolved value does not match the expected type.
 * This error provides details about the expected and received types.
 */
export class InvalidTypeError extends Error {
    /**
     * Creates an instance of InvalidTypeError.
     * @param expected - The expected type as a string.
     * @param received - The actual type received as a string.
     * @param details - Additional details about the error.
     */
    constructor(expected: string, received: string, details: string) {
      super(`Expected ${expected.toLowerCase()}, received ${received}. ${details}`);
      this.name = "InvalidTypeError";
    }
}

/**
 * Error thrown when a resolved instance does not match the Zod schema.
 * This error indicates that the validation against the schema has failed.
 */
export class InvalidSchemaError extends Error {
    /**
     * Creates an instance of InvalidSchemaError.
     * @param message - The error message describing the schema validation failure.
     */
    constructor(message: string) {
      super(message);
      this.name = 'InvalidSchemaError';
    }
}