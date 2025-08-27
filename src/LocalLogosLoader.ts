import * as fs from "fs";
import * as path from "path";
import { ManufacturersLogos } from "./types";
import BaseClass from "./BaseClass";
import { LogosTargetLocation } from "./config";

interface LocalLogoEntry {
  name: string;
  slug: string;
  fileName: string;
}

class LocalLogosLoader extends BaseClass {
  logos: ManufacturersLogos = [];
  private localLogosDir = path.resolve("./local-logos");
  private localLogosMetaPath = path.resolve("./local-logos/metadata.json");

  protected async copyLogoToTargets(sourceFile: string, fileName: string): Promise<void> {
    const originalTarget = path.join(LogosTargetLocation.Original, fileName);
    
    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Source logo file not found: ${sourceFile}`);
    }

    // Copy to original directory
    fs.copyFileSync(sourceFile, originalTarget);
    console.log(`Copied ${fileName} to original directory`);
  }

  protected loadLocalLogosMetadata(): LocalLogoEntry[] {
    if (!fs.existsSync(this.localLogosMetaPath)) {
      console.log("No local logos metadata found, skipping local logo loading.");
      return [];
    }

    try {
      const metadataContent = fs.readFileSync(this.localLogosMetaPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      if (!Array.isArray(metadata)) {
        throw new Error("Local logos metadata must be an array");
      }

      return metadata;
    } catch (error) {
      console.error(`Error loading local logos metadata: ${error.message}`);
      return [];
    }
  }

  protected async processLocalLogos(): Promise<void> {
    const localEntries = this.loadLocalLogosMetadata();
    
    if (localEntries.length === 0) {
      return;
    }

    console.log(`Processing ${localEntries.length} local logo(s)`);

    for (const entry of localEntries) {
      try {
        const sourceFile = path.join(this.localLogosDir, entry.fileName);
        
        await this.copyLogoToTargets(sourceFile, entry.fileName);

        this.logos.push({
          name: entry.name,
          slug: entry.slug,
          image: { source: sourceFile }
        });

        console.log(`${this.chalk.green("Processed local logo:")} ${entry.name}`);
      } catch (error) {
        console.error(`${this.chalk.red("Failed to process local logo:")} ${entry.name} - ${error.message}`);
      }
    }
  }

  public async run(): Promise<ManufacturersLogos> {
    try {
      console.log("Loading local logos...");
      
      if (!fs.existsSync(this.localLogosDir)) {
        console.log("No local-logos directory found, skipping local logo loading.");
        return this.logos;
      }

      await this.processLocalLogos();

      if (this.logos.length > 0) {
        console.log(`Loaded ${this.chalk.bold(this.logos.length)} local logo(s).`);
      }
    } catch (error) {
      console.error("Error in LocalLogosLoader:", error);
    }

    return this.logos;
  }
}

export default LocalLogosLoader;