import { Container } from "../mod.ts";

const container = new Container();

class RandomNumberGenerator {
  value = Math.random();
}

// Bind as transient (new instance every time)
container.transient(RandomNumberGenerator, () => new RandomNumberGenerator());

const instance1 = container.resolve(RandomNumberGenerator);
const instance2 = container.resolve(RandomNumberGenerator);

console.log(instance1.value !== instance2.value); // Output: true
