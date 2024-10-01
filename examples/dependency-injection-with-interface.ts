import { Container } from "../mod.ts";

const container = new Container();

interface PaymentProcessor {
  process(amount: number): string;
}

class PayPalProcessor implements PaymentProcessor {
  process(amount: number): string {
    return `Processed $${amount} with PayPal`;
  }
}

class StripeProcessor implements PaymentProcessor {
  process(amount: number): string {
    return `Processed $${amount} with Stripe`;
  }
}

// Bind PayPal as default payment processor
container.bind('PaymentProcessor', () => new PayPalProcessor());

// Optionally bind Stripe
container.bind('PaymentProcessor_Stripe', () => new StripeProcessor());

const payPalProcessor = container.resolve<PaymentProcessor>('PaymentProcessor');
console.log(payPalProcessor.process(100)); // Output: Processed $100 with PayPal

const stripeProcessor = container.resolve<PaymentProcessor>('PaymentProcessor_Stripe');
console.log(stripeProcessor.process(200)); // Output: Processed $200 with Stripe
