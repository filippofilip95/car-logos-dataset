import path from "path";

export const BASE_URL = "https://www.carlogos.org";

export const THUMB_HEIGHT = 256;

export const META_JSON_PATH = path.resolve("./logos/optimized") + "/logos.json";

export const LogosPath = {
  Optimized: path.resolve("./logos/optimized"),
  Thumbs: path.resolve("./logos/thumbs"),
  Original: path.resolve("./logos/original"),
};

export const Url = {
  AllManufacturers: `${BASE_URL}/car-brands-a-z`,
  Manufacturer: (url: string) => `${BASE_URL}/${url}`,
};

export const Selector = {
  AllManufacturers: ".a-z dd a",
  ManufacturerLogo: `div.logo-content a img`,
};
