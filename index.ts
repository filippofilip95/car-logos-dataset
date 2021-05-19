import LogosScrapper from "./src/LogosScrapper";
import ImageFormatter from "./src/ImageFormatter";

(async function main() {
  const scrapper = new LogosScrapper();
  const formatter = new ImageFormatter();

  await scrapper.run();
  await formatter.run();
})();
