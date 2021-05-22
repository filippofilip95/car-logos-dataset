type Manufacturer = {
  name: string;
  url: string;
};

export type Manufacturers = Manufacturer[];

type ManufacturerLogo = {
  name: string;
  slug: string;
  image: {
    source: string;
  };
};

export type ManufacturersLogos = ManufacturerLogo[];

type OptimizedManufacturerLogo = {
  image: {
    original: string;
    thumb: string;
    optimized: string;
  };
} & ManufacturerLogo;

export type OptimizedManufacturerLogos = OptimizedManufacturerLogo[];
