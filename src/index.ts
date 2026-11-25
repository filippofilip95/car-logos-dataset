import LogoScrapper from "./LogoScrapper";
import LocalLogosLoader from "./LocalLogosLoader";
import ImageOptimizer from "./ImageOptimizer";
import DataFinalizer from "./DataFinalizer";
import { assertNoShrink, currentLogoCount } from "./guard";

(async function () {
  const scrapedLogos = await new LogoScrapper().run();
  const localLogos = await new LocalLogosLoader().run();
  const allLogos = [...scrapedLogos, ...localLogos];
  try {
    assertNoShrink(allLogos.length, currentLogoCount());
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  const images = await new ImageOptimizer().run();
  await new DataFinalizer({logos: allLogos, images}).run();
})();
