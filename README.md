# Dependency Injection Container

A flexible and powerful dependency injection container for TypeScript/JavaScript projects, with Zod schema integration for runtime type checking.

## Table of Contents

1. [Basic Binding](#1-basic-binding)
2. [Binding Interfaces to Implementations](#2-binding-interfaces-to-implementations)
3. [Contextual Binding](#3-contextual-binding)
4. [Binding Primitives](#4-binding-primitives)
5. [Extending Bindings](#5-extending-bindings)
6. [Automatic Injection](#6-automatic-injection)
7. [Aliasing](#7-aliasing)
8. [Binding Instances](#8-binding-instances)
9. [Tagging](#9-tagging)
10. [Contextual Binding with Interfaces](#10-contextual-binding-with-interfaces)
11. [Method Invocation](#11-method-invocation)
12. [Error Handling](#12-error-handling)
13. [Zod Schema Integration](#13-zod-schema-integration)
14. [Binding Functions](#14-binding-functions)
15. [Binding Strings](#15-binding-strings)
16. [Async Dependencies](#16-async-dependencies)

## 1. Basic Binding

Basic binding allows you to register classes and resolve them later.
