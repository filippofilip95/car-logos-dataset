import path from "path";

export const BASE_URL = "https://www.carlogos.org";

export const BASE_PUBLIC_ACCESS_URL =
  "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master";

export const THUMB_HEIGHT = 256;

export const META_JSON_PATH = path.resolve("./logos/data.json");

export const LogosTargetLocation = {
  Optimized: path.resolve("./logos/optimized"),
  Thumbs: path.resolve("./logos/thumb"),
  Original: path.resolve("./logos/original"),
};

export const LocalAccessPath = {
  Optimized: (file: string) => `./optimized/${file}`,
  Thumb: (file: string) => `./thumb/${file}`,
  Original: (file: string) => `./original/${file}`,
};

export const PublicAccessUrl = {
  Thumb: (file: string) => `${BASE_PUBLIC_ACCESS_URL}/logos/thumb/${file}`,
  Original: (file: string) =>
    `${BASE_PUBLIC_ACCESS_URL}/logos/original/${file}`,
  Optimized: (file: string) =>
    `${BASE_PUBLIC_ACCESS_URL}/logos/optimized/${file}`,
};

export const Url = {
  AllManufacturers: `${BASE_URL}/car-brands-a-z`,
  Manufacturer: (url: string) => `${BASE_URL}/${url}`,
};

export const Selector = {
  AllManufacturers: ".a-z dd a",
  ManufacturerLogo: `div.logo-content a img`,
};
