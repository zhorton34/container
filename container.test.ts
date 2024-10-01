import { Container } from "./container.ts";
import { assertEquals, assertThrows } from "@std/assert";
import { InvalidAliasError, InvalidTagError, UnresolvedDependencyError } from "./errors.ts";

Deno.test("LaravelContainer - Basic Binding and Resolving", () => {
  const container = new Container();

  class TestService {
    getName() {
      return "TestService";
    }
  }

  container.bind("TestService", TestService);

  const instance = container.make("TestService") as TestService;
  assertEquals(instance.getName(), "TestService");
});

Deno.test("LaravelContainer - Singleton Binding", () => {
  const container = new Container();

  class SingletonService {
    value = Math.random();
  }

  container.singleton("SingletonService", SingletonService);

  const instance1 = container.make("SingletonService") as SingletonService;
  const instance2 = container.make("SingletonService") as SingletonService;
  assertEquals(instance1.value, instance2.value);
});

Deno.test("Container - Contextual Binding", () => {
  const container = new Container();

  class FilesystemType {
    constructor(public value: string) {}
  }

  class PhotoController {
      static paramTypes = [FilesystemType];
      constructor(public filesystem: FilesystemType) {}
  }

  class VideoController {
      static paramTypes = [FilesystemType];
      constructor(public filesystem: FilesystemType) {}
  }

  container.bind(FilesystemType, () => new FilesystemType("default"));

  container.when(PhotoController).needs(FilesystemType).give(() => new FilesystemType("local"));
  const photoController = container.createInstance(PhotoController);
  assertEquals(photoController.filesystem.value, "local");
  
  container.when(VideoController).needs(FilesystemType).give(() => new FilesystemType("s3"));
  const videoController = container.createInstance(VideoController);
  assertEquals(videoController.filesystem.value, "s3");
});

Deno.test("LaravelContainer - Tagging and Resolving Tagged Services", () => {
  const container = new Container();

  class ReportService {
    constructor(public type: string) {}
    generate() {
      return `${this.type} Report`;
    }
  }

  container.bind("PDFReport", () => new ReportService("PDF"));
  container.bind("CSVReport", () => new ReportService("CSV"));

  container.tag(["PDFReport", "CSVReport"], "reports");

  const reports = container.tagged("reports") as ReportService[];
  assertEquals(reports.length, 2);
  assertEquals(reports[0].generate(), "PDF Report");
  assertEquals(reports[1].generate(), "CSV Report");
});

Deno.test("LaravelContainer - Aliasing", () => {
  const container = new Container();

  class Logger {
    log(message: string) {
      console.log(message);
    }
  }

  container.bind("FileLogger", Logger);
  container.alias("FileLogger", "Logger");

  const logger = container.make("Logger") as Logger;
  assertEquals(logger instanceof Logger, true);
});

Deno.test("LaravelContainer - Invalid Alias Error", () => {
  const container = new Container();

  assertThrows(
    () => container.make("NonExistentAlias"),
    UnresolvedDependencyError,
    "No binding found for the given type: NonExistentAlias"
  );
});

Deno.test("LaravelContainer - Invalid Tag Error", () => {
  const container = new Container();

  assertThrows(
    () => container.tagged("nonexistent-tag"),
    InvalidTagError,
    "No bindings found for tag: 'nonexistent-tag'"
  );
});

Deno.test("LaravelContainer - Unresolved Dependency Error", () => {
  const container = new Container();

  assertThrows(
    () => container.make("UnregisteredService"),
    UnresolvedDependencyError,
    "No binding found for the given type: UnregisteredService"
  );
});

Deno.test("LaravelContainer - Binding and Resolving Functions", () => {
  const container = new Container();

  const greet = (name: string) => `Hello, ${name}!`;

  container.bind("greet", () => greet);

  const greetFn = container.make("greet") as (name: string) => string;
  assertEquals(greetFn("Alice"), "Hello, Alice!");
});

Deno.test("LaravelContainer - Binding Instances", () => {
  const container = new Container();

  class Config {
    constructor(public data: Record<string, any>) {}
  }

  const configInstance = new Config({ app_name: "MyApp" });
  container.instance("Config", configInstance);

  const resolvedConfig = container.make("Config") as Config;
  assertEquals(resolvedConfig, configInstance);
});

Deno.test("Container - Tagging", () => {
    const container = new Container();

    interface Report {
        generate(): string;
    }

    class PDFReport implements Report {
        generate() { return 'PDF Report'; }
    }

    class CSVReport implements Report {
        generate() { return 'CSV Report'; }
    }

    container.bind(PDFReport, () => new PDFReport());
    container.bind(CSVReport, () => new CSVReport());

    container.tag([PDFReport, CSVReport], 'reports');

    const reports = container.tagged('reports') as Report[];
    assertEquals(reports.length, 2);
    assertEquals(reports[0].generate(), 'PDF Report');
    assertEquals(reports[1].generate(), 'CSV Report');
});
