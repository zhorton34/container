import { z } from 'zod';
import { 
  InvalidSchemaError, 
  CircularDependencyError, 
  UnresolvedDependencyError 
} from './errors.ts';
export type Bindable = string | symbol | Function | object;

export enum Lifetime {
  Singleton,
  Transient,
  Scoped,
}

export interface Binding {
  factory: Function;
  lifetime: Lifetime;
  instance?: any;
  resolver: Function;
}

export interface ContextualBinding {
  when: Bindable;
  need: Bindable;
  give: Function | any;
}

type Middleware = (next: () => any) => any;

export class DIContainer {
  private bindings = new Map<Bindable, Binding>();
  private instances = new Map<Bindable, any>();
  private aliases: Map<string | symbol, Bindable> = new Map();
  private tags = new Map<string, Bindable[]>();
  public contextualBindings = new Map<Bindable, ContextualBinding[]>();
  private resolvingStack: Bindable[] = [];
  private parent: DIContainer | null = null;
  private children: DIContainer[] = [];
  private middlewares: Middleware[] = [];

  // Bind a type to a factory function
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
      lifetime: Lifetime.Transient,
      resolver: (container: DIContainer) => factory(container),
    });
    return this;
  }

  // Bind a singleton
  singleton(abstract: Bindable, factory: Function): this {
    this.bindings.set(abstract, {
      factory,
      lifetime: Lifetime.Singleton,
      resolver: factory,
    });
    return this;
  }

  // Bind an instance
  instance(abstract: Bindable, instance: any): this {
    this.instances.set(abstract, instance);
    return this;
  }

  // Alias an abstract type
  alias(alias: string | symbol, abstract: Bindable): void {
    this.aliases.set(alias, abstract);
  }

  // Tagging
  tag(abstracts: Bindable[], tag: string): this {
    if (!this.tags.has(tag)) {
      this.tags.set(tag, []);
    }
    this.tags.get(tag)?.push(...abstracts);
    return this;
  }

  createInstance<T>(Target: Bindable & WithParamTypes): T {
    // Remove the use of Reflect.getMetadata
    const paramTypes = Target.paramTypes || [];
    const injections = paramTypes.map((param: any) => this.resolveWithContext(param, Target));
    return new (Target as any)(...injections);
  }

  private resolveWithContext(abstract: Bindable, context: Bindable): any {
    const contextualBindings = this.contextualBindings.get(context) || [];
    const binding = contextualBindings.find(b => b.need === abstract);
    if (binding) {
      return typeof binding.give === 'function' ? binding.give(this) : binding.give;
    }
    return this.resolve(abstract);
  }

  // Contextual binding
  when(concrete: Bindable): ContextualBindingBuilder {
    return new ContextualBindingBuilder(this, concrete);
  }

  // Resolve a type
  resolve<T = any>(abstract: Bindable, context?: Bindable): T {
    const originalAbstract = abstract;
    abstract = this.getAlias(abstract);

    if (this.instances.has(abstract)) {
      return this.instances.get(abstract);
    }

    if (this.resolvingStack.includes(abstract)) {
      throw new CircularDependencyError(this.resolvingStack.concat(abstract).map(String));
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
      } else if (binding.lifetime === Lifetime.Scoped) {
        instance = binding.resolver(this);
      } else {
        // Check for contextual bindings
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

  // Build an instance
  private build(binding: Binding, context?: Bindable): any {
    return binding.resolver(this, context);
  }

  // Get alias
  private getAlias(abstract: Bindable): Bindable {
    if (typeof abstract === 'string' || typeof abstract === 'symbol') {
      return this.aliases.get(abstract) || abstract;
    }
    return abstract;
  }

  // Get tagged
  tagged(tag: string): any[] {
    const abstracts = this.tags.get(tag) || [];
    return abstracts.map((abstract) => this.resolve(abstract));
  }

  // Add new methods for async resolution
  async resolveAsync<T = any>(abstract: Bindable, context?: Bindable): Promise<T> {
    const instance = this.resolve<T | Promise<T>>(abstract, context);
    return instance instanceof Promise ? await instance : instance;
  }

  // Add new method for transient bindings
  transient(abstract: Bindable, factory: Function): this {
    this.bindings.set(abstract, {
      factory,
      lifetime: Lifetime.Transient,
      resolver: factory,
    });
    return this;
  }

  // Add new method for scoped bindings
  scoped(abstract: Bindable, factory: Function): this {
    this.bindings.set(abstract, {
      factory,
      lifetime: Lifetime.Scoped,
      resolver: (container: DIContainer) => {
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

  // Add new method to create a scope
  createScope(): DIContainer {
    const childContainer = new DIContainer();
    childContainer.parent = this;
    this.children.push(childContainer);
    return childContainer;
  }

  // Add new method for disposal
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

  createChild(): DIContainer {
    const child = new DIContainer();
    child.parent = this;
    return child;
  }

  lazyBind<T>(token: any, factory: () => T): void {
    this.bind(token, () => {
      const instance = factory();
      this.instance(token, instance);
      return instance;
    });
  }

  private resolveCircular<T>(token: any): T {
    const proxy = new Proxy({}, {
      get: (target, prop) => {
        const instance = this.resolve<T>(token);
        return instance[prop as keyof T];
      }
    });
    return proxy as T;
  }

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
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
}

export class ContextualBindingBuilder {
  constructor(private container: DIContainer, private concrete: Bindable) {}

  needs(need: Bindable): ContextualBindingNeedsBuilder {
    return new ContextualBindingNeedsBuilder(this.container, this.concrete, need);
  }
}

class ContextualBindingNeedsBuilder {
  constructor(
    private container: DIContainer,
    private concrete: Bindable,
    private need: Bindable,
  ) {}

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

// Add this interface to define the structure for classes with paramTypes
interface WithParamTypes {
  paramTypes?: any[];
}

export class Observer {
  private listeners: Map<string, Function[]> = new Map();

  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  publish(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }
}