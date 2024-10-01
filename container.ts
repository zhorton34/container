import { Container as FindHowContainer, type Bindable, type Constructor } from "./mod.ts";
import { InvalidTagError } from "./errors.ts";

type Abstract = Bindable;

/**
 * Interface for defining contextual bindings in the container.
 * This allows you to define what a concrete type should be given when a specific abstract type is needed.
 */
export interface ContextualBindingBuilder {
  needs(abstract: Abstract): this;
  give(implementation: (() => any) | Abstract): void;
  giveTagged(tag: string): void;
  giveConfig(key: string, defaultValue?: any): void;
}

/**
 * Interface representing a Laravel-style container.
 */
export interface LaravelContainer {
  bound(abstract: Abstract): boolean;
  alias(abstract: Abstract, alias: string): void;
  tag(abstracts: Abstract | Abstract[], tags: string | string[]): void;
  tagged(tag: string): any[];
  bind(abstract: Abstract, concrete?: Function | Abstract, shared?: boolean): void;
  bindMethod(method: string | [string, string], callback: Function): void;
  bindIf(abstract: Abstract, concrete?: Function | Abstract, shared?: boolean): void;
  singleton(abstract: Abstract, concrete?: Function | Abstract): void;
  singletonIf(abstract: Abstract, concrete?: Function | Abstract): void;
  scoped(abstract: Abstract, concrete?: Function | Abstract): void;
  scopedIf(abstract: Abstract, concrete?: Function | Abstract): void;
  extend(abstract: Abstract, closure: Function): void;
  instance(abstract: Abstract, instance: any): void;
  addContextualBinding(concrete: Abstract, abstract: Abstract, implementation: Function | Abstract): void;
  when(concrete: Abstract): ContextualBindingBuilder;
  factory(abstract: Abstract): Function;
  flush(): void;
  make(abstract: Abstract, parameters?: any[]): any;
  call(callback: Function | string, parameters?: any[], defaultMethod?: string): any;
  resolved(abstract: Abstract): boolean;
  beforeResolving(abstract: Abstract | Function, callback?: Function): void;
  resolving(abstract: Abstract | Function, callback?: Function): void;
  afterResolving(abstract: Abstract | Function, callback?: Function): void;
  register<T>(constructor: Constructor<T>, paramTypes: (Bindable | Bindable[])[]): void;
}

/**
 * The Container class implements the LaravelContainer interface and provides
 * a dependency injection container for managing class dependencies and performing
 * dependency injection.
 */
export class Container implements LaravelContainer {
  private container: FindHowContainer;
  private beforeResolvingCallbacks = new Map<Bindable, Function[]>();
  private resolvingCallbacks = new Map<Bindable, Function[]>();
  private afterResolvingCallbacks = new Map<Bindable, Function[]>();
  private tags = new Map<string, Abstract[]>();

  constructor() {
    this.container = new FindHowContainer();
  }

  /**
   * Determine if the given abstract type has been bound.
   *
   * @param {Abstract} abstract - The abstract type to check.
   * @returns {boolean} True if the abstract type is bound, false otherwise.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('logger', () => new Logger());
   * console.log(container.bound('logger')); // true
   * console.log(container.bound('database')); // false
   * ```
   */
  bound(abstract: Abstract): boolean {
    return this.container.bindings.has(abstract) || this.container.aliases.has(abstract as string);
  }

  /**
   * Alias a type to a different name.
   *
   * @param {Abstract} abstract - The abstract type to alias.
   * @param {string} alias - The alias name.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('logger', () => new Logger());
   * container.alias('logger', 'log');
   * const logger = container.make('log');
   * ```
   */
  alias(abstract: Abstract, alias: string): void {
    this.container.alias(alias, abstract);
  }

  /**
   * Register a class and its dependencies with the container.
   *
   * @param {Constructor<T>} constructor - The class constructor to register.
   * @param {(Bindable | Bindable[])[]} paramTypes - The parameter types for the constructor.
   *
   * @example
   * ```typescript
   * class UserService {
   *   constructor(private logger: Logger) {}
   * }
   * 
   * const container = new Container();
   * container.register(UserService, [Logger]);
   * ```
   */
  register<T>(constructor: Constructor<T>, paramTypes: (Bindable | Bindable[])[]): void {
    this.container.register(constructor, paramTypes);
  }

  /**
   * Assign a set of tags to a given abstract type(s).
   *
   * @param {Abstract | Abstract[]} abstracts - The abstract type(s) to tag.
   * @param {string | string[]} tags - The tag(s) to assign.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('report', () => new Report());
   * container.bind('logger', () => new Logger());
   * container.tag(['report', 'logger'], 'services');
   * ```
   */
  tag(abstracts: Abstract | Abstract[], tags: string | string[]): void {
    const abstractsArray = Array.isArray(abstracts) ? abstracts : [abstracts];
    const tagsArray = Array.isArray(tags) ? tags : [tags];
    for (const tag of tagsArray) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, []);
      }
      this.tags.get(tag)!.push(...abstractsArray);
    }
    this.container.tag(abstractsArray, tagsArray[0]);
  }

  /**
   * Resolve all of the bindings for a given tag.
   *
   * @param {string} tag - The tag to resolve.
   * @returns {any[]} An array of resolved bindings.
   * @throws {InvalidTagError} If no bindings are found for the given tag.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('report', () => new Report());
   * container.bind('logger', () => new Logger());
   * container.tag(['report', 'logger'], 'services');
   * 
   * const services = container.tagged('services');
   * // services will be an array containing instances of Report and Logger
   * ```
   */
  tagged(tag: string): any[] {
    const bindings = this.tags.get(tag) || [];
    if (bindings.length === 0) {
      throw new InvalidTagError(`No bindings found for tag: '${tag}'`);
    }
    return bindings.map(binding => this.make(binding));
  }

  /**
   * Register a binding with the container.
   *
   * @param {Abstract} abstract - The abstract type to bind.
   * @param {Function | Abstract} [concrete] - The concrete implementation.
   * @param {boolean} [shared=false] - Whether the binding should be shared.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * // Binding a class
   * container.bind('logger', Logger);
   * 
   * // Binding a factory function
   * container.bind('database', () => new Database());
   * 
   * // Binding a shared instance
   * container.bind('config', Config, true);
   * ```
   */
  bind(abstract: Abstract, concrete: Function | Abstract = abstract, shared = false): void {
    if (shared) {
      this.singleton(abstract, concrete);
    } else {
      this.container.bind(abstract, () => {
        if (typeof concrete === "function" && concrete.prototype) {
          return new (concrete as Constructor<any>)();
        }
        return typeof concrete === "function" ? concrete : () => concrete;
      });
    }
  }

  bindMethod(method: string | [string, string], callback: Function): void {
    const [className, methodName] = Array.isArray(method) ? method : method.split("@");
    this.container.bind(`${className}@${methodName}`, () => callback);
  }

  bindIf(abstract: Abstract, concrete: Function | Abstract = abstract, shared = false): void {
    if (!this.bound(abstract)) {
      this.bind(abstract, concrete, shared);
    }
  }

  /**
   * Register a shared binding in the container.
   *
   * @param {Abstract} abstract - The abstract type to bind.
   * @param {Function | Abstract} [concrete] - The concrete implementation.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * // Binding a shared instance
   * container.singleton('database', Database);
   * 
   * // The same instance will be returned each time
   * const db1 = container.make('database');
   * const db2 = container.make('database');
   * console.log(db1 === db2); // true
   * ```
   */
  singleton(abstract: Abstract, concrete: Function | Abstract = abstract): void {
    this.container.bindSingleton(abstract, () => {
      if (typeof concrete === "function" && concrete.prototype) {
        return new (concrete as Constructor<any>)();
      }
      return typeof concrete === "function" ? concrete : () => concrete;
    });
  }

  /**
   * Register a shared binding if it hasn't already been registered.
   *
   * @param {Abstract} abstract - The abstract type to bind.
   * @param {Function | Abstract} [concrete] - The concrete implementation.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * // This will bind Config as a singleton
   * container.singletonIf('config', Config);
   * 
   * // This will not override the existing binding
   * container.singletonIf('config', DifferentConfig);
   * ```
   */
  singletonIf(abstract: Abstract, concrete: Function | Abstract = abstract): void {
    if (!this.bound(abstract)) {
      this.singleton(abstract, concrete);
    }
  }

  /**
   * Register a scoped binding in the container.
   *
   * @param {Abstract} abstract - The abstract type to bind.
   * @param {Function | Abstract} [concrete] - The concrete implementation.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * // Binding a scoped instance
   * container.scoped('request', Request);
   * ```
   */
  scoped(abstract: Abstract, concrete: Function | Abstract = abstract): void {
    this.bind(abstract, concrete);
  }

  /**
   * Register a scoped binding if it hasn't already been registered.
   *
   * @param {Abstract} abstract - The abstract type to bind.
   * @param {Function | Abstract} [concrete] - The concrete implementation.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * // This will bind Request as a scoped instance
   * container.scopedIf('request', Request);
   * 
   * // This will not override the existing binding
   * container.scopedIf('request', DifferentRequest);
   * ```
   */
  scopedIf(abstract: Abstract, concrete: Function | Abstract = abstract): void {
    if (!this.bound(abstract)) {
      this.scoped(abstract, concrete);
    }
  }

  /**
   * Extend an abstract type in the container.
   *
   * @param {Abstract} abstract - The abstract type to extend.
   * @param {Function} closure - The closure to run when the abstract is resolved.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('logger', () => new Logger());
   * 
   * container.extend('logger', (logger) => {
   *   logger.level = 'debug';
   *   return logger;
   * });
   * 
   * const logger = container.make('logger');
   * console.log(logger.level); // 'debug'
   * ```
   */
  extend(abstract: Abstract, closure: Function): void {
    this.container.extend(abstract, (original: unknown) => closure(original));
  }

  /**
   * Register an existing instance as shared in the container.
   *
   * @param {Abstract} abstract - The abstract type to bind.
   * @param {any} instance - The instance to register.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * const config = new Config();
   * 
   * container.instance('config', config);
   * 
   * const resolvedConfig = container.make('config');
   * console.log(resolvedConfig === config); // true
   * ```
   */
  instance(abstract: Abstract, instance: any): void {
    this.container.instance(abstract, instance);
  }

  /**
   * Add a contextual binding to the container.
   *
   * @param {Abstract} concrete - The concrete type.
   * @param {Abstract} abstract - The abstract type.
   * @param {Function | Abstract} implementation - The implementation.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * container.addContextualBinding(UserController, Logger, FileLogger);
   * ```
   */
  addContextualBinding(concrete: Abstract, abstract: Abstract, implementation: Function | Abstract): void {
    this.container.when(concrete as Constructor<any>).needs(abstract as Constructor<any>).give(implementation);
  }

  /**
   * Define a contextual binding.
   *
   * @param {Abstract} concrete - The concrete type.
   * @returns {ContextualBindingBuilder} A contextual binding builder instance.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * 
   * container.when(UserController)
   *   .needs(Logger)
   *   .give(FileLogger);
   * ```
   */
  when(concrete: Abstract): ContextualBindingBuilder {
    return new ContextualBindingBuilderImpl(concrete, this.container);
  }

  /**
   * Get a closure to resolve the given type from the container.
   *
   * @param {Abstract} abstract - The abstract type to resolve.
   * @returns {Function} A closure that resolves the abstract type.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('logger', () => new Logger());
   * 
   * const loggerFactory = container.factory('logger');
   * const logger1 = loggerFactory();
   * const logger2 = loggerFactory();
   * console.log(logger1 !== logger2); // true
   * ```
   */
  factory(abstract: Abstract): Function {
    return () => this.make(abstract);
  }

  /**
   * Flush all of the container's bindings.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('logger', () => new Logger());
   * 
   * container.flush();
   * 
   * console.log(container.bound('logger')); // false
   * ```
   */
  flush(): void {
    this.container = new FindHowContainer();
  }

  /**
   * Resolve the given type from the container.
   *
   * @param {Abstract} abstract - The abstract type to resolve.
   * @param {Bindable[]} [parameters=[]] - Optional parameters to pass to the resolver.
   * @returns {any} The resolved instance.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('logger', () => new Logger());
   * 
   * const logger = container.make('logger');
   * ```
   */
  make(abstract: Abstract, parameters: Bindable[] = []): any {
    if (this.container.aliases.has(abstract as string)) {
      abstract = this.container.aliases.get(abstract as string) as Abstract;
    }
    this.runBeforeResolvingCallbacks(abstract);
    const resolved = this.container.resolve(abstract);
    this.runResolvingCallbacks(abstract, resolved);
    this.runAfterResolvingCallbacks(abstract, resolved);
    
    if (resolved && (resolved as any).constructor && (resolved as any).constructor.paramTypes) {
      const paramTypes = (resolved as any).constructor.paramTypes;
      const dependencies = paramTypes.map((param: Abstract) => this.make(param));
      return new (resolved as any).constructor(...dependencies);
    }
    
    return typeof resolved === "function" 
    ? resolved(...[parameters.map(p => this.bound(p) ? this.make(p) : p)]) 
    : resolved;
  }

  /**
   * Call the given function / class method and inject its dependencies.
   *
   * @param {Function | string} callback - The function or class method to call.
   * @param {Bindable[]} [parameters=[]] - Optional parameters to pass to the callback.
   * @param {string} [defaultMethod] - The default method to call if not specified.
   * @returns {any} The result of the function call.
   *
   * @example
   * ```typescript
   * const container = new Container();
   * container.bind('logger', () => new Logger());
   * 
   * function doSomething(logger) {
   *   logger.log('Something happened');
   * }
   * 
   * container.call(doSomething);
   * 
   * // Or with a class method
   * container.call('UserController@index');
   * ```
   */
  call(callback: Function | string, parameters: Bindable[] = [], defaultMethod?: string): any {
    if (typeof callback === "string") {
      const [className, methodName] = callback.split("@");
      const instance = this.make(className);
      return (instance as any)[methodName](...[parameters.map(p => this.bound(p) ? this.make(p) : p)]);
    } else {
      return callback(...[parameters.map(p => this.bound(p) ? this.make(p) : p)]);
    }
  }

  resolved(abstract: Abstract): boolean {
    return this.bound(abstract);
  }

  beforeResolving(abstract: Bindable, callback: Function): void {
    this.addCallbackToMap(this.beforeResolvingCallbacks, abstract, callback);
  }

  resolving(abstract: Bindable, callback: Function): void {
    this.addCallbackToMap(this.resolvingCallbacks, abstract, callback);
  }

  afterResolving(abstract: Bindable, callback: Function): void {
    this.addCallbackToMap(this.afterResolvingCallbacks, abstract, callback);
  }

  private addCallbackToMap(map: Map<Bindable, Function[]>, abstract: Bindable, callback: Function): void {
    if (!map.has(abstract)) {
      map.set(abstract, []);
    }
    map.get(abstract)!.push(callback);
  }

  private runBeforeResolvingCallbacks(abstract: Abstract): void {
    this.runCallbacks(this.beforeResolvingCallbacks, abstract);
  }

  private runResolvingCallbacks(abstract: Abstract, instance: any): void {
    this.runCallbacks(this.resolvingCallbacks, abstract, instance);
  }

  private runAfterResolvingCallbacks(abstract: Abstract, instance: any): void {
    this.runCallbacks(this.afterResolvingCallbacks, abstract, instance);
  }

  private runCallbacks(map: Map<Bindable, Function[]>, abstract: Abstract, instance?: any): void {
    const callbacks = map.get(abstract) || [];
    for (const callback of callbacks) {
      callback(instance);
    }
  }

  createInstance<T>(constructor: new (...args: any[]) => T): T {
    const paramTypes = (constructor as any).paramTypes || [];
    const resolvedDependencies = paramTypes.map((type: any) => this.make(type));
    return new constructor(...resolvedDependencies);
  }

  private resolve(abstract: Abstract): any {
    return this.make(abstract);
  }
}

/**
 * The ContextualBindingBuilderImpl class implements the ContextualBindingBuilder interface
 * and provides methods for defining contextual bindings.
 */
class ContextualBindingBuilderImpl implements ContextualBindingBuilder {
  private concrete: Abstract;
  private container: FindHowContainer;
  private abstract?: Abstract; // Make the property optional

  constructor(concrete: Abstract, container: FindHowContainer) {
    this.concrete = concrete;
    this.container = container;
  }

  /**
   * Specifies the abstract type that the concrete type needs.
   * This method is part of the fluent interface for defining contextual bindings.
   * 
   * @param {Abstract} abstract - The abstract type that the concrete type needs.
   * @returns {this} The current instance for method chaining.
   * 
   * @example
   * ```typescript
   * container.when(PhotoController).needs(Filesystem).give(() => new LocalFilesystem());
   * ```
   */
  needs(abstract: Abstract): this {
    this.abstract = abstract;
    this.container.when(this.concrete as Constructor<any>).needs(abstract as Constructor<any>);
    return this;
  }

  /**
   * Specifies the implementation to be given when the concrete type needs the abstract type.
   * 
   * @param {((): any) | Abstract} implementation - The implementation to be given. Can be a factory function or an abstract type.
   * 
   * @example
   * ```typescript
   * container.when(PhotoController).needs(Filesystem).give(() => new S3Filesystem());
   * // Or
   * container.when(PhotoController).needs(Filesystem).give(LocalFilesystem);
   * ```
   */
  give(implementation: (() => any) | Abstract): void {
    this.container.when(this.concrete as Constructor<any>).needs(this.abstract as Constructor<any>).give(implementation);
    this.abstract = null!;
  }

  /**
   * Specifies that all services tagged with the given tag should be given when the concrete type needs the abstract type.
   * 
   * @param {string} tag - The tag used to identify the services.
   * 
   * @example
   * ```typescript
   * container.tag(['PDFReport', 'CSVReport'], 'reports');
   * container.when(ReportManager).needs('reports').giveTagged('reports');
   * ```
   */
  giveTagged(tag: string): void {
    const services = this.container.tagged(tag);
    this.container.when(this.concrete as Constructor<any>).needs(tag as any).give(() => services);
  }

  /**
   * Specifies that a configuration value should be given when the concrete type needs the abstract type.
   * 
   * @param {string} key - The configuration key.
   * @param {any} [defaultValue=null] - The default value to use if the configuration key is not found.
   * 
   * @example
   * ```typescript
   * container.when(DatabaseConnection).needs('db.host').giveConfig('database.host', 'localhost');
   * ```
   */
  giveConfig(key: string, defaultValue: any = null): void {
    const configValue = this.getConfigValue(key, defaultValue);
    this.container.when(this.concrete as Constructor<any>).needs(key as any).give(() => configValue);
  }

  private getConfigValue(key: string, defaultValue: any): any {
    // Implement the logic to retrieve the configuration value
    // Replace with actual logic for fetching config values if needed
    return defaultValue;
  }
}