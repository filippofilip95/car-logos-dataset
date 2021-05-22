type Manufacturer = {
  name: string;
  url: string;
};

export type Manufacturers = Manufacturer[];

export type CoreManufacturerLogo = {
  name: string;
  slug: string;
  image: {
    source: string;
  };
};

export type ManufacturersLogos = CoreManufacturerLogo[];

export type ManufacturerLogo = {
  image: {
    original: string;
    thumb: string;
    optimized: string;
  };
} & CoreManufacturerLogo;

export type ManufacturerLogos = ManufacturerLogo[];

export type PreFinalizedResults = {
  logos: ManufacturersLogos;
  images: {
    originals: string[];
    optimized: string[];
    thumbs: string[];
  };
};
