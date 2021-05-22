import LogoScrapper from "./src/LogoScrapper";
import ImageOptimizer from "./src/ImageOptimizer";
import DataFinalizer from "./src/DataFinalizer";

(async function main() {
  const logos = await new LogoScrapper().run();
  const images = await new ImageOptimizer().run();
  await new DataFinalizer({ logos, images }).run();
})();
