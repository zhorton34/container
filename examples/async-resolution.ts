import { DIContainer } from "../mod.ts";

const container = new DIContainer();

class AsyncService {
  async getValue() {
    return await new Promise((resolve) => setTimeout(() => resolve("Async Value"), 100));
  }
}

// Bind with async initialization
container.bind(AsyncService, async () => {
  await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
  return new AsyncService();
});

// Resolve asynchronously
(async () => {
  const service = await container.resolveAsync(AsyncService);
  console.log(await service.getValue()); // Output: Async Value
})();
