import { z } from 'zod';
import { 
  InvalidSchemaError, 
  CircularDependencyError, 
  UnresolvedDependencyError 
} from './errors.ts';
import { 
  Bindable, 
  Binding, 
  ContextualBinding, 
  Middleware, 
  WithParamTypes, 
  IContainer, 
  IContextualBindingBuilder, 
  IContextualBindingNeedsBuilder, 
  IObserver,
  Lifetime, // Import Lifetime enum directly
} from './types.ts';

/**
 * Dependency Injection Container
 * 
 * The Container class provides a way to manage dependencies and their lifecycles.
 * It supports various binding types, contextual bindings, and middleware.
 */
export class Container implements IContainer {
  private bindings = new Map<Bindable, Binding>();
  private instances = new Map<Bindable, any>();
  private aliases: Map<string | symbol, Bindable> = new Map();
  private tags = new Map<string, Bindable[]>();
  public contextualBindings = new Map<Bindable, ContextualBinding[]>();
  private resolvingStack: Bindable[] = [];
  private parent: Container | null = null;
  private children: Container[] = [];
  private middlewares: Middleware[] = [];

  // Binding Methods

  /**
   * Bind a type to a factory function.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @param schema - Optional Zod schema for validation.
   * @returns The Container instance.
   * 
   * @example
   * ```typescript
   * container.bind('MyService', () => new MyService());
   * ```
   */
  bind(abstract: Bindable, factory: Function, schema?: z.ZodType<any>): this {
    if (schema) {
      try {
        const instance = factory(this);
        schema.parse(instance);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new InvalidSchemaError(`Invalid schema for ${String(abstract)}: ${error.message}`);
        }
        throw error;
      }
    }
    this.bindings.set(abstract, {
      factory,
      lifetime: Lifetime.Transient, // Use Lifetime.Transient as default
      resolver: (container: Container) => factory(container),
    });
    return this;
  }

  /**
   * Bind a singleton.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @returns The Container instance.
   * 
   * @example
   * ```typescript
   * container.singleton('MySingletonService', () => new MySingletonService());
   * ```
   */
  singleton(abstract: Bindable, factory: Function): this {
    this.bindings.set(abstract, {
      factory,
      lifetime: Lifetime.Singleton,
      resolver: factory,
    });
    return this;
  }

  /**
   * Bind an instance.
   * 
   * @param abstract - The abstract type to bind.
   * @param instance - The instance to bind.
   * @returns The Container instance.
   * 
   * @example
   * ```typescript
   * container.instance('MyInstance', new MyInstance());
   * ```
   */
  instance(abstract: Bindable, instance: any): this {
    this.instances.set(abstract, instance);
    return this;
  }

  /**
   * Alias an abstract type.
   * 
   * @param alias - The alias to create.
   * @param abstract - The abstract type to alias.
   * 
   * @example
   * ```typescript
   * container.alias('Logger', 'ConsoleLogger');
   * ```
   */
  alias(alias: string | symbol, abstract: Bindable): void {
    this.aliases.set(alias, abstract);
  }

  /**
   * Tag multiple abstracts with a tag.
   * 
   * @param abstracts - The abstracts to tag.
   * @param tag - The tag to assign.
   * @returns The Container instance.
   * 
   * @example
   * ```typescript
   * container.tag(['ServiceA', 'ServiceB'], 'services');
   * ```
   */
  tag(abstracts: Bindable[], tag: string): this {
    if (!this.tags.has(tag)) {
      this.tags.set(tag, []);
    }
    this.tags.get(tag)?.push(...abstracts);
    return this;
  }

  // Resolution Methods

  /**
   * Resolve a type.
   * 
   * @param abstract - The abstract type to resolve.
   * @param context - Optional context for contextual bindings.
   * @returns The resolved instance.
   * 
   * @example
   * ```typescript
   * const myService = container.resolve<MyService>('MyService');
   * ```
   */
  resolve<T = any>(abstract: Bindable, context?: Bindable): T {
    const originalAbstract = abstract;
    abstract = this.getAlias(abstract);

    if (this.instances.has(abstract)) {
      return this.instances.get(abstract);
    }

    if (this.resolvingStack.includes(abstract)) {
      // Return a proxy object for circular dependencies
      return new Proxy({} as any, {
        get: (target, prop) => {
          if (prop === 'isCircularDependency') return true;
          if (typeof prop === 'string' && prop !== 'then') {
            return (...args: any[]) => {
              const resolvedInstance = this.resolve(abstract);
              return (resolvedInstance as any)[prop](...args);
            };
          }
          return undefined;
        },
      });
    }

    this.resolvingStack.push(abstract);

    try {
      let binding = this.bindings.get(abstract);
      if (!binding) {
        if (this.parent) {
          return this.parent.resolve<T>(originalAbstract);
        }
        throw new UnresolvedDependencyError(originalAbstract);
      }

      let instance;
      if (binding.lifetime === Lifetime.Singleton && binding.instance) {
        instance = binding.instance;
      } else {
        if (context) {
          const contextualBindings = this.contextualBindings.get(context) || [];
          const contextualBinding = contextualBindings.find(b => b.need === abstract);
          if (contextualBinding) {
            instance = typeof contextualBinding.give === 'function' 
              ? contextualBinding.give(this) 
              : contextualBinding.give;
          }
        }
        
        if (!instance) {
          instance = this.build(binding, context);
        }

        if (binding.lifetime === Lifetime.Singleton) {
          binding.instance = instance;
          this.instances.set(abstract, instance);
        }
      }

      return this.applyMiddleware(() => instance);
    } finally {
      this.resolvingStack.pop();
    }
  }

  /**
   * Resolve a type asynchronously.
   * 
   * @param abstract - The abstract type to resolve.
   * @param context - Optional context for contextual bindings.
   * @returns A promise that resolves to the instance.
   * 
   * @example
   * ```typescript
   * const myService = await container.resolveAsync<MyService>('MyService');
   * ```
   */
  async resolveAsync<T = any>(abstract: Bindable, context?: Bindable): Promise<T> {
    const instance = await this.resolve<T>(abstract, context);
    return instance instanceof Promise ? await instance : instance;
  }

  /**
   * Create an instance of a class with dependencies.
   * 
   * @param Target - The class to instantiate.
   * @returns The created instance.
   * 
   * @example
   * ```typescript
   * const myClassInstance = container.createInstance(MyClass);
   * ```
   */
  createInstance<T>(Target: Bindable & WithParamTypes): T {
    const paramTypes = Target.paramTypes || [];
    const injections = paramTypes.map((param: any) => this.resolveWithContext(param, Target));
    return new (Target as any)(...injections);
  }

  // Contextual Binding Methods

  /**
   * Create a contextual binding.
   * 
   * @param concrete - The concrete type to bind.
   * @returns A builder for defining the contextual binding.
   * 
   * @example
   * ```typescript
   * container.when('MyService').needs('Config').give(() => new Config());
   * ```
   */
  when(concrete: Bindable): IContextualBindingBuilder {
    return new ContextualBindingBuilder(this, concrete);
  }

  // Lifecycle Methods

  /**
   * Create a new scope.
   * 
   * @returns A new Container instance representing the scope.
   * 
   * @example
   * ```typescript
   * const scopedContainer = container.createScope();
   * ```
   */
  createScope(): IContainer {
    const childContainer = new Container();
    childContainer.parent = this;
    this.children.push(childContainer);
    return childContainer;
  }

  /**
   * Dispose of the container and its bindings.
   * 
   * @example
   * ```typescript
   * container.dispose();
   * ```
   */
  dispose(): void {
    for (const [, binding] of this.bindings) {
      if (binding.instance && typeof binding.instance.dispose === 'function') {
        binding.instance.dispose();
      }
    }
    for (const child of this.children) {
      child.dispose();
    }
    this.bindings.clear();
    this.instances.clear();
    this.aliases.clear();
    this.tags.clear();
    this.contextualBindings.clear();
    this.children = [];
  }

  /**
   * Create a child container.
   * 
   * @returns A new Container instance representing the child container.
   * 
   * @example
   * ```typescript
   * const childContainer = container.createChild();
   * ```
   */
  createChild(): IContainer {
    const child = new Container();
    child.parent = this;
    return child;
  }

  /**
   * Bind a transient.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @returns The Container instance.
   * 
   * @example
   * ```typescript
   * container.transient('MyService', () => new MyService());
   * ```
   */
  transient(abstract: Bindable, factory: Function): this {
    this.bindings.set(abstract, {
      factory,
      lifetime: Lifetime.Transient,
      resolver: factory,
    });
    return this;
  }

  /**
   * Bind a scoped instance.
   * 
   * @param abstract - The abstract type to bind.
   * @param factory - The factory function to create the instance.
   * @returns The Container instance.
   * 
   * @example
   * ```typescript
   * container.scoped('MyService', () => new MyService());
   * ```
   */
  scoped(abstract: Bindable, factory: Function): this {
    this.bindings.set(abstract, {
      factory,
      lifetime: Lifetime.Scoped,
      resolver: (container: Container) => {
        if (container.instances.has(abstract)) {
          return container.instances.get(abstract);
        }
        const instance = factory(container);
        container.instances.set(abstract, instance);
        return instance;
      },
    });
    return this;
  }

  /**
   * Lazy bind a type to a factory function.
   * 
   * @param token - The token to bind.
   * @param factory - The factory function to create the instance.
   * 
   * @example
   * ```typescript
   * container.lazyBind('MyService', () => new MyService());
   * ```
   */
  lazyBind<T>(token: any, factory: () => T): void {
    this.bind(token, () => {
      const instance = factory();
      this.instance(token, instance);
      return instance;
    });
  }

  // Middleware Methods

  /**
   * Use a middleware function.
   * 
   * @param middleware - The middleware function to use.
   * 
   * @example
   * ```typescript
   * container.use(next => {
   *   console.log('Before');
   *   const result = next();
   *   console.log('After');
   *   return result;
   * });
   * ```
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  // Private Methods

  private resolveWithContext(abstract: Bindable, context: Bindable): any {
    const contextualBindings = this.contextualBindings.get(context) || [];
    const binding = contextualBindings.find(b => b.need === abstract);
    if (binding) {
      return typeof binding.give === 'function' ? binding.give(this) : binding.give;
    }
    return this.resolve(abstract);
  }

  private build(binding: Binding, context?: Bindable): any {
    return binding.resolver(this, context);
  }

  private getAlias(abstract: Bindable): Bindable {
    if (typeof abstract === 'string' || typeof abstract === 'symbol') {
      return this.aliases.get(abstract) || abstract;
    }
    return abstract;
  }

  private applyMiddleware(factory: () => any): any {
    let index = -1;
    const dispatch = (i: number): any => {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'));
      index = i;
      let fn = this.middlewares[i];
      if (i === this.middlewares.length) fn = factory;
      if (!fn) return;
      try {
        return fn(() => dispatch(i + 1));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    return dispatch(0);
  }

  // Add this method
  tagged(tag: string): any[] {
    const taggedBindables = this.tags.get(tag) || [];
    return taggedBindables.map(bindable => this.resolve(bindable));
  }
}

/**
 * Contextual Binding Builder
 * 
 * The ContextualBindingBuilder class provides a way to define contextual bindings.
 */
class ContextualBindingBuilder implements IContextualBindingBuilder {
  constructor(private container: Container, private concrete: Bindable) {}

  /**
   * Define the dependency that the concrete type needs.
   * 
   * @param need - The dependency that the concrete type needs.
   * @returns A builder for defining the contextual binding.
   * 
   * @example
   * ```typescript
   * container.when('MyService').needs('Config').give(() => new Config());
   * ```
   */
  needs(need: Bindable): IContextualBindingNeedsBuilder {
    return new ContextualBindingNeedsBuilder(this.container, this.concrete, need);
  }
}

/**
 * Contextual Binding Needs Builder
 * 
 * The ContextualBindingNeedsBuilder class provides a way to define the value or factory function for a contextual binding.
 */
class ContextualBindingNeedsBuilder implements IContextualBindingNeedsBuilder {
  constructor(
    private container: Container,
    private concrete: Bindable,
    private need: Bindable,
  ) {}

  /**
   * Define the value or factory function for the contextual binding.
   * 
   * @param give - The value or factory function to provide.
   * 
   * @example
   * ```typescript
   * container.when('MyService').needs('Config').give(() => new Config());
   * ```
   */
  give(give: Function | any): void {
    if (!this.container.contextualBindings.has(this.concrete)) {
      this.container.contextualBindings.set(this.concrete, []);
    }
    this.container.contextualBindings.get(this.concrete)?.push({
      when: this.concrete,
      need: this.need,
      give,
    });
  }
}

/**
 * Observer
 * 
 * The Observer class provides a way to implement the observer pattern.
 */
export class Observer implements IObserver {
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Subscribe to an event.
   * 
   * @param event - The event to subscribe to.
   * @param callback - The callback function to call when the event is published.
   * 
   * @example
   * ```typescript
   * observer.subscribe('myEvent', data => {
   *   console.log('Event received:', data);
   * });
   * ```
   */
  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Publish an event.
   * 
   * @param event - The event to publish.
   * @param data - Optional data to pass to the event listeners.
   * 
   * @example
   * ```typescript
   * observer.publish('myEvent', { key: 'value' });
   * ```
   */
  publish(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }
}