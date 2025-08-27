import LogoScrapper from "./LogoScrapper";
import LocalLogosLoader from "./LocalLogosLoader";
import ImageOptimizer from "./ImageOptimizer";
import DataFinalizer from "./DataFinalizer";

(async function () {
  const scrapedLogos = await new LogoScrapper().run();
  const localLogos = await new LocalLogosLoader().run();
  const allLogos = [...scrapedLogos, ...localLogos];
  const images = await new ImageOptimizer().run();
  await new DataFinalizer({logos: allLogos, images}).run();
})();
