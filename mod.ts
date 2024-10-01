import { z } from "zod";

import {
    InvalidExtensionError,
    InvalidAliasError,
    InvalidTagError,
    InvalidContextualBindingError,
    CircularDependencyError,
    UnresolvedDependencyError,
} from "./errors.ts";

export type Constructor<T = any> = new (...args: any[]) => T;
export type AnyFunction = (...args: any[]) => any;
export type Bindable = Constructor | AnyFunction | Function | z.ZodType<any> | string;

export class Container {
  public bindings = new Map<Bindable, () => any>();
  public singletons = new Map<Bindable, any>();
  public contextualBindings = new Map<Constructor<any>, Map<Bindable, () => any>>();
  public aliases = new Map<string, Bindable>();
  public tags = new Map<string, Bindable[]>();
  public customErrorHandlers = new Map<z.ZodType<any>, (error: z.ZodError) => void>();

  bind<T>(type: Bindable, factory: () => T): void {
    console.info(`Binding type: ${type}`);

    this.bindings.set(type, factory);
  }

  bindSingleton<T>(type: Bindable, factory: () => T): void {
    console.info(`Binding singleton type: ${type}`);

    this.bind(type, () => {
      if (!this.singletons.has(type)) {
        this.singletons.set(type, factory());

        console.info(`Singleton instance created for type: ${type}`);
      }
      return this.singletons.get(type);
    });
  }

  private detectCircularDependencies(
    constructor: Constructor<any>,
    stack: Set<string> = new Set(),
    visited: Set<string> = new Set()
  ): void {
    const constructorName = constructor.name;
  
    // If the constructor is already in the stack, a circular dependency is detected
    if (stack.has(constructorName)) {
      console.error(`Circular dependency detected: ${[...stack, constructorName].join(' -> ')}`);

      throw new CircularDependencyError([...stack, constructorName]);
    }
  
    // If the constructor has already been visited and no circular dependency was found, skip further checks
    if (visited.has(constructorName)) {
      return;
    }
  
    // Mark this constructor as visited
    visited.add(constructorName);
  
    // Add to the stack to track the current path
    stack.add(constructorName);
  
    const paramTypes = (constructor as any).paramTypes || [];
  
    for (const paramType of paramTypes) {
      const actualType =
        typeof paramType === "function"
          ? paramType.prototype
            ? paramType
            : paramType()
          : paramType;
  
      // Ensure the actual type is defined
      if (!actualType) continue;
  
      // Get the dependency constructor
      const dependency = this.bindings.get(actualType);
      if (!dependency) {
        console.warn(`Unresolved dependency: ${String(actualType)}`);

        throw new UnresolvedDependencyError(String(actualType));
      }
  
      const dependencyConstructor = dependency();
      if (typeof dependencyConstructor === "function" && dependencyConstructor.prototype) {
        // Check for circular dependency before recursive call
        if (stack.has(dependencyConstructor.name)) {
          console.error(`Circular dependency detected: ${[...stack, dependencyConstructor.name].join(' -> ')}`);
          throw new CircularDependencyError([...stack, dependencyConstructor.name]);
        }
        // Detect circular dependencies in the dependency constructor
        this.detectCircularDependencies(dependencyConstructor, new Set(stack), visited);
      }
    }
  
    // Remove from the stack after processing to avoid false positives
    stack.delete(constructorName);
  }
  

  register<T>(constructor: Constructor<T>, paramTypes: (Bindable | Bindable[])[] = []): void {
    try {
      console.info(`Registering constructor: ${constructor.name}`);

      paramTypes.forEach(type => this.detectCircularDependencies(type as Constructor<any>));
    } catch (error) {
      console.error(`Circular dependency detected: ${error.message}`);
      
      throw error;
    }

    const proxiedConstructor = new Proxy(constructor, {
      construct: (target, args, newTarget) => {
        const injectedArgs = args.length > 0 ? args : paramTypes.map(type => 
          Array.isArray(type) ? this.resolveAll(type[0]) : this.resolve(type)
        );
        return Reflect.construct(target, injectedArgs, newTarget);
      }
    });

    this.bind(constructor, () => proxiedConstructor);
  }

  registerFunction<T extends AnyFunction>(func: T, paramTypes: Bindable[]): T {
    console.info(`Registering function: ${func.name}`);

    return new Proxy(func, {
      apply: (target, thisArg, args) => {
        const injectedArgs = args.length > 0 ? args : paramTypes.map(type => this.resolve(type));
        return target.apply(thisArg, injectedArgs);
      }
    }) as T;
  }

  createInstance<T>(constructor: Constructor<T>): T {
    try {
      console.info(`Creating instance of: ${constructor.name}`);

      this.detectCircularDependencies(constructor); // Ensure circular dependencies are detected
    } catch (error) {
      console.error(`Circular dependency detected: ${error.message}`);

      throw error;
    }
    if (!this.bindings.has(constructor)) {

      this.register(constructor);
    }

    try {
      this.detectCircularDependencies(constructor); // Ensure circular dependencies are detected
    } catch (error) {
      console.error(`Circular dependency detected: ${error.message}`);
      
      throw error;
    }

    const ConstructorProxy = this.resolve(constructor) as Constructor<T>;
    
    const paramTypes = (constructor as any).paramTypes || [];
    
    const params = paramTypes.map((paramType: Bindable, index: number) => {
      const contextualBinding = this.contextualBindings.get(constructor)?.get(paramType);

      if (contextualBinding !== undefined) {
        const value = typeof contextualBinding === 'function' ? contextualBinding() : contextualBinding;
        if (value === undefined) {
          throw new InvalidContextualBindingError(constructor.name, String(paramType));
        }
        return value;
      }

      if (Array.isArray(paramType)) {
        return this.resolveAll(paramType[0]);
      }

      return this.resolve(paramType);
    });

    return new ConstructorProxy(...params);
  }

  when<T>(constructor: Constructor<T>) {
    console.info(`When binding for: ${constructor.name}`);

    return {
      needs: (type: Bindable) => {
        console.info(`When binding for: ${constructor.name}`);

        return {
          give: (implementation: (() => any) | any) => {
            console.info(`When binding for: ${constructor.name}`);

            if (!this.contextualBindings.has(constructor)) {
              this.contextualBindings.set(constructor, new Map());
            }
            const bindings = this.contextualBindings.get(constructor)!;
            
            if (typeof implementation === 'function') {
              bindings.set(type, implementation);
            } else {
              bindings.set(type, () => implementation);
            }

            this.bind(type, () => implementation);
          }
        };
      }
    };
  }

  extend<T>(type: Bindable, extender: (original: T) => T): void {
    console.info(`Extending type: ${type}`);
    const originalFactory = this.bindings.get(type);
    if (!originalFactory) {
      console.error(`Invalid extension error: ${type}`);
      throw new InvalidExtensionError(type);
    }
    this.bind(type, () => extender(originalFactory()));
  }

  resolve<T>(type: Bindable): T {
    const factory = this.bindings.get(type);
    console.info(`Resolving type: ${type}`);
    if (!factory) {
      console.error(`Unresolved dependency error: ${String(type)}`);
      throw new UnresolvedDependencyError(String(type));
    }
  
    if (typeof type === 'function' && type.prototype) {
      console.info(`Detecting circular dependencies for: ${type}`);
      try {
        this.detectCircularDependencies(type as Constructor<any>);
      } catch (error) {
        console.error(`Circular dependency detected: ${error.message}`);
        throw error;
      }
    }
  
    const result = factory();
    if (type instanceof z.ZodType) {
      console.info(`Validating with custom errors for: ${type.constructor.name}`);
      return this.validateWithCustomErrors(type, result);
    }
    return result as T;
  }

  resolveAll<T>(type: Bindable): T[] {
    console.info(`Resolving all for: ${type}`);
    const results: T[] = [];
    for (const [key, factory] of this.bindings.entries()) {
      if (key === type) {
        const result = factory();
        if (Array.isArray(result)) {
          console.info(`Pushing result: ${result}`);
          results.push(...result);
        } else {
          console.info(`Pushing result: ${result}`);
          results.push(result);
        }
      }
    }
    console.info(`Results: ${results}`);
    return results;
  }

  alias(alias: string, type: Bindable): void {
    console.info(`Aliasing: ${alias} to ${type}`);
    this.aliases.set(alias, type);
  }

  make(alias: string): any {
    console.info(`Making: ${alias}`);
    const type = this.aliases.get(alias);
    if (!type) {
      console.error(`Invalid alias error: ${alias}`);
      throw new InvalidAliasError(alias);
    }
    return this.resolve(type);
  }

  instance<T>(type: Bindable, instance: T): void {
    console.info(`Binding instance of: ${type}`);
    this.bind(type, () => instance);
  }

  tag(types: Bindable[], tag: string): void {
    console.info(`Tagging: ${types} with ${tag}`);
    if (!this.tags.has(tag)) {
      console.info(`Setting tag: ${tag}`);
      this.tags.set(tag, []);
    }
    this.tags.get(tag)!.push(...types);
  }

  tagged(tag: string): any[] {
    const types = this.tags.get(tag);
    console.info(`Getting tagged: ${tag}`);
    if (!types || types.length === 0) {
      console.error(`Invalid tag error: ${tag}`);
      throw new InvalidTagError(tag);
    }
    return types.map(type => this.resolve(type));
  }

  call(target: [Constructor<any>, string] | AnyFunction, args: any[] = []): any {
    console.info(`Calling: ${target}`);
    if (Array.isArray(target)) {
      const [Class, method] = target;
      const instance = this.createInstance(Class);
      console.info(`Calling method: ${method} on instance: ${instance}`);
      return (instance as any)[method](...args);
    } else {
      console.info(`Registering function: ${target.name}`);
      return this.registerFunction(target, [])(...args);
    }
  }

  singleton<T>(type: Bindable, factory: () => T): void {
    console.info(`Binding singleton of: ${type}`);
    this.bindSingleton(type, factory);
  }

  bindCustomError<T>(schema: z.ZodType<T>, handler: (error: z.ZodError) => void): void {
    console.info(`Binding custom error for: ${schema.constructor.name}`);
    this.customErrorHandlers.set(schema, handler);
  }

  private validateWithCustomErrors<T>(schema: z.ZodType<T>, data: unknown): T {
    console.info(`Validating with custom errors for: ${schema.constructor.name}`);
    const result = schema.safeParse(data);
    if (result.success) {
      console.info(`Validation passed for: ${schema.constructor.name}`);
      return result.data;
    } else {
      console.error(`Validation failed for: ${schema.constructor.name}`);
      const error = (result as z.SafeParseError<T>).error;
      console.error("Validation failed:", error);

      const customHandler = this.customErrorHandlers.get(schema);
      if (customHandler) {
        console.info(`Calling custom error handler for: ${schema.constructor.name}`);
        customHandler(error);
      }
      console.info(`Handling nested errors for: ${schema.constructor.name}`);
      this.handleNestedErrors(error);
      throw error;
    }
  }

  private handleNestedErrors(error: z.ZodError): void {
    console.info(`Handling nested errors for: ${error.name}`);
    const invokedHandlers = new Set<z.ZodType<any>>();
  
    // Iterate through each issue in the error
    error.errors.forEach(issue => {
      console.info(`Handling nested errors for: ${issue.path}`);
      if (issue.path.length > 0) {
        // Recursively handle each part of the nested path
        let currentPath: (string | number)[] = [];
        for (let i = 0; i < issue.path.length; i++) {
          currentPath.push(issue.path[i]);
          const nestedSchema = this.findNestedSchema(currentPath);
          if (nestedSchema && !invokedHandlers.has(nestedSchema)) {
            const customHandler = this.customErrorHandlers.get(nestedSchema);
            if (customHandler) {
              console.info(`Calling custom error handler for: ${nestedSchema.constructor.name}`);
              customHandler(new z.ZodError([issue]));
              invokedHandlers.add(nestedSchema);  // Mark this handler as invoked
            }
          }
        }
      }
    });
  }
    
  private findNestedSchema(path: (string | number)[]): z.ZodType<any> | undefined {
    console.info(`Finding nested schema for: ${path}`);
    for (const [schema] of this.customErrorHandlers) {
      let currentSchema: z.ZodType<any> | undefined = schema;
  
      // Traverse the schema using the path
      for (const key of path) {
        if (currentSchema instanceof z.ZodObject) {
          const shape = currentSchema.shape as { [key: string]: z.ZodType<any> };
          if (shape[key]) {
            currentSchema = shape[key];
          } else {
            currentSchema = undefined;
            break;
          }
        } else if (currentSchema instanceof z.ZodOptional || currentSchema instanceof z.ZodNullable) {
          currentSchema = currentSchema._def.innerType;
        } else {
          currentSchema = undefined;
          break;
        }
      }
  
      if (currentSchema) {
        return currentSchema;
      }
    }
  
    return undefined;
  }
  

  callWithDynamicSchema<T extends (...args: any[]) => any>(
    func: T,
    data: Parameters<T>[0],
    schema: z.ZodType<Parameters<T>[0]>
  ): ReturnType<T> {
    console.info(`Calling with dynamic schema for: ${func.name}`);
    const validatedData = this.validateWithCustomErrors(schema, data);
    console.info(`Validated data: ${validatedData}`);
    return func(validatedData);
  }
}

export { z };
export { DIContainer } from "./dicontainer.ts";
