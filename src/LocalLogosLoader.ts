import * as fs from "fs";
import * as path from "path";
import { ManufacturersLogos } from "./types";
import BaseClass from "./BaseClass";
import { LogosTargetLocation } from "./config";

interface CustomLogoEntry {
  name: string;
  slug: string;
  fileName: string;
}

class LocalLogosLoader extends BaseClass {
  logos: ManufacturersLogos = [];
  private customLogosDir = path.resolve("./custom-logos");
  private customLogosMetaPath = path.resolve("./custom-logos/metadata.json");

  protected async copyLogoToTargets(sourceFile: string, fileName: string): Promise<void> {
    const originalTarget = path.join(LogosTargetLocation.Original, fileName);
    
    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Source logo file not found: ${sourceFile}`);
    }

    // Copy to original directory
    fs.copyFileSync(sourceFile, originalTarget);
    console.log(`Copied ${fileName} to original directory`);
  }

  protected loadCustomLogosMetadata(): CustomLogoEntry[] {
    if (!fs.existsSync(this.customLogosMetaPath)) {
      console.log("No custom logos metadata found, skipping custom logo loading.");
      return [];
    }

    try {
      const metadataContent = fs.readFileSync(this.customLogosMetaPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);
      
      if (!Array.isArray(metadata)) {
        throw new Error("Custom logos metadata must be an array");
      }

      return metadata;
    } catch (error) {
      console.error(`Error loading custom logos metadata: ${error.message}`);
      return [];
    }
  }

  protected async processCustomLogos(): Promise<void> {
    const customEntries = this.loadCustomLogosMetadata();
    
    if (customEntries.length === 0) {
      return;
    }

    console.log(`Processing ${customEntries.length} custom logo(s)`);

    for (const entry of customEntries) {
      try {
        const sourceFile = path.join(this.customLogosDir, entry.fileName);
        
        await this.copyLogoToTargets(sourceFile, entry.fileName);

        this.logos.push({
          name: entry.name,
          slug: entry.slug,
          image: { source: sourceFile }
        });

        console.log(`${this.chalk.green("Processed custom logo:")} ${entry.name}`);
      } catch (error) {
        console.error(`${this.chalk.red("Failed to process custom logo:")} ${entry.name} - ${error.message}`);
      }
    }
  }

  public async run(): Promise<ManufacturersLogos> {
    try {
      console.log("Loading custom logos...");
      
      if (!fs.existsSync(this.customLogosDir)) {
        console.log("No custom-logos directory found, skipping custom logo loading.");
        return this.logos;
      }

      await this.processCustomLogos();

      if (this.logos.length > 0) {
        console.log(`Loaded ${this.chalk.bold(this.logos.length)} custom logo(s).`);
      }
    } catch (error) {
      console.error("Error in LocalLogosLoader:", error);
    }

    return this.logos;
  }
}

export default LocalLogosLoader;