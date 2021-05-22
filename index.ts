import LogosScrapper from "./src/LogosScrapper";
import LogosOptimizer from "./src/LogosOptimizer";
import LogosDataFinalizer from "./src/LogosDataFinalizer";

(async function main() {
  const logos = await new LogosScrapper().run();
  const optimized = await new LogosOptimizer().run();
  await new LogosDataFinalizer({logos, optimized}).run();
})();
