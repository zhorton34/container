import { z } from 'zod';

/**
 * Represents a type that can be bound to the DI container.
 * This can include strings, symbols, functions, or objects.
 */
export type Bindable = string | symbol | Function | object;

/**
 * Enum representing the different lifetimes for bindings in the DI container.
 */
export enum Lifetime {
  /** 
   * Singleton lifetime: A single instance is created and shared across all requests.
   */
  Singleton,
  
  /** 
   * Transient lifetime: A new instance is created each time it is requested.
   */
  Transient,
  
  /** 
   * Scoped lifetime: An instance is created per scope (e.g., per request).
   */
  Scoped,
}

// Remove or comment out this line:
// export type { Lifetime as LifetimeEnum };

/**
 * Interface representing a binding in the DI container.
 */
export interface Binding {
  /** 
   * The factory function used to create the instance.
   */
  factory: Function;

  /** 
   * The lifetime of the binding, determining how instances are managed.
   */
  lifetime: Lifetime;

  /** 
   * The instance created by the factory, if applicable (for Singleton and Scoped lifetimes).
   */
  instance?: any;

  /** 
   * The resolver function used to resolve the binding.
   */
  resolver: Function;
}

/**
 * Interface representing a contextual binding in the DI container.
 */
export interface ContextualBinding {
  /** 
   * The concrete type that this binding is associated with.
   */
  when: Bindable;

  /** 
   * The dependency that this binding provides.
   */
  need: Bindable;

  /** 
   * The value or factory function that provides the dependency.
   */
  give: Function | any;
}

/**
 * Interface for classes that have parameter types defined.
 */
export interface WithParamTypes {
  /** 
   * An optional array of parameter types for the class constructor.
   */
  paramTypes?: any[];
}

/**
 * Type representing a middleware function in the DI container.
 * Middleware can intercept and modify the resolution process.
 * 
 * @param next - A function to call the next middleware in the chain.
 * @returns The result of the middleware processing.
 */
export type Middleware = (next: () => any) => any;

/**
 * Interface for the Dependency Injection Container.
 */
export interface IContainer {
  /**
   * Bind a type to a factory function.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @param schema - Optional Zod schema for validation.
   * @returns The IContainer instance.
   */
  bind(abstract: Bindable, factory: Function, schema?: z.ZodType<any>): this;

  /**
   * Bind a singleton.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @returns The IContainer instance.
   */
  singleton(abstract: Bindable, factory: Function): this;

  /**
   * Bind an instance.
   * 
   * @param abstract - The abstract type to bind.
   * @param instance - The instance to bind.
   * @returns The IContainer instance.
   */
  instance(abstract: Bindable, instance: any): this;

  /**
   * Alias an abstract type.
   * 
   * @param alias - The alias to create.
   * @param abstract - The abstract type to alias.
   */
  alias(alias: string | symbol, abstract: Bindable): void;

  /**
   * Tag multiple abstracts with a tag.
   * 
   * @param abstracts - The abstracts to tag.
   * @param tag - The tag to assign.
   * @returns The IContainer instance.
   */
  tag(abstracts: Bindable[], tag: string): this;

  /**
   * Create an instance of a class with dependencies.
   * 
   * @param Target - The class to instantiate.
   * @returns The created instance.
   */
  createInstance<T>(Target: Bindable & WithParamTypes): T;

  /**
   * Resolve a type.
   * 
   * @param abstract - The abstract type to resolve.
   * @param context - Optional context for contextual bindings.
   * @returns The resolved instance.
   */
  resolve<T = any>(abstract: Bindable, context?: Bindable): T;

  /**
   * Resolve a type asynchronously.
   * 
   * @param abstract - The abstract type to resolve.
   * @param context - Optional context for contextual bindings.
   * @returns A promise that resolves to the instance.
   */
  resolveAsync<T = any>(abstract: Bindable, context?: Bindable): Promise<T>;

  /**
   * Bind a transient.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @returns The IContainer instance.
   */
  transient(abstract: Bindable, factory: Function): this;

  /**
   * Bind a scoped instance.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @returns The IContainer instance.
   */
  scoped(abstract: Bindable, factory: Function): this;

  /**
   * Create a new scope.
   * 
   * @returns A new IContainer instance representing the scope.
   */
  createScope(): IContainer;

  /**
   * Dispose of the container and its bindings.
   */
  dispose(): void;

  /**
   * Create a child container.
   * 
   * @returns A new IContainer instance representing the child container.
   */
  createChild(): IContainer;

  /**
   * Lazy bind a type to a factory function.
   * 
   * @param token - The token to bind.
   * @param factory - The factory function to create the instance.
   */
  lazyBind<T>(token: any, factory: () => T): void;

  /**
   * Use a middleware function.
   * 
   * @param middleware - The middleware function to use.
   */
  use(middleware: Middleware): void;
}

/**
 * Interface for the Contextual Binding Builder.
 */
export interface IContextualBindingBuilder {
  /**
   * Define the dependency that the concrete type needs.
   * 
   * @param need - The dependency that the concrete type needs.
   * @returns A builder for defining the contextual binding.
   */
  needs(need: Bindable): IContextualBindingNeedsBuilder;
}

/**
 * Interface for the Contextual Binding Needs Builder.
 */
export interface IContextualBindingNeedsBuilder {
  /**
   * Define the value or factory function for the contextual binding.
   * 
   * @param give - The value or factory function to provide.
   */
  give(give: Function | any): void;
}

/**
 * Interface for the Observer.
 */
export interface IObserver {
  /**
   * Subscribe to an event.
   * 
   * @param event - The event to subscribe to.
   * @param callback - The callback function to call when the event is published.
   */
  subscribe(event: string, callback: Function): void;

  /**
   * Publish an event.
   * 
   * @param event - The event to publish.
   * @param data - Optional data to pass to the event listeners.
   */
  publish(event: string, data?: any): void;
}