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

// Open brand metadata (npm run metadata); null when the source has no single value.
export type BrandMetadata = {
  wikidataId?: string | null;
  country?: string | null;
  founded?: number | null;
  nhtsaMakeId?: number | null;
};

export type ManufacturerLogo = BrandMetadata & {
  image: {
    original: string;
    localOriginal: string;
    thumb: string;
    localThumb: string;
    optimized: string;
    localOptimized: string;
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
