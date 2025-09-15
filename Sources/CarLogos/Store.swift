import Foundation
import SwiftUI

public enum CarLogosStore {
    public enum Variant {
      case thumb
      case optimized
      case original
    }

    private static func logosBaseURL() -> URL? {
        // Look for the `logos` directory inside bundled resources
        if let explicit = Bundle.module.url(forResource: "logos", withExtension: nil) {
            return explicit
        }

        // Fallback (some SPM setups): resourceURL/logos
        if let res = Bundle.module.resourceURL?.appendingPathComponent("logos"),
           FileManager.default.fileExists(atPath: res.path) {
            return res
        }

        return nil
    }

    private static func dataJSONURL() -> URL? {
        // data.json lives directly under logos/
        if let base = logosBaseURL() {
            let url = base.appendingPathComponent("data.json")
            if FileManager.default.fileExists(atPath: url.path) {
              return url
            }
        }
        // As an extra fallback, try subdirectory lookup
        return Bundle.module.url(
          forResource: "data",
          withExtension: "json",
          subdirectory: "logos")
    }

    /// Load and decode all logo metadata from the bundled `data.json`.
    public static func all() throws -> [CarLogo] {
        guard let url = dataJSONURL() else {
            throw NSError(
              domain: "CarLogos",
              code: 1,
              userInfo: [
                NSLocalizedDescriptionKey: "data.json not found in bundled resources. Ensure Resources/logos is included."
              ])
        }

        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()

        return try decoder.decode([CarLogo].self, from: data)
    }

    public static func logoForSlug(_ slug: String) -> CarLogo? {
        return try? all().first(where: { $0.slug == slug })
    }

    public static func imageForLogo(_ logo: CarLogo, variant: Variant = .optimized) -> Image? {
        guard let url = localURL(for: logo, variant: variant) else {
          return nil
        }

        #if os(macOS)
        if let nsImage = NSImage(contentsOf: url) {
          return Image(nsImage: nsImage)
        }
        #else
        if let uiImage = UIImage(contentsOfFile: url.path) {
          return Image(uiImage: uiImage)
        }
        #endif

        return nil
    }

    /// Resolve the best local path for a given variant, falling back sensibly.
    public static func localPath(for logo: CarLogo, variant: Variant) -> String? {
        switch variant {
        case .thumb:
            return logo.image.localThumb ?? logo.image.localOptimized ?? logo.image.localOriginal
        case .optimized:
            return logo.image.localOptimized ?? logo.image.localOriginal ?? logo.image.localThumb
        case .original:
            return logo.image.localOriginal ?? logo.image.localOptimized ?? logo.image.localThumb
        }
    }

    /// Get a file URL for the selected image variant inside the bundle.
    public static func localURL(for logo: CarLogo, variant: Variant) -> URL? {
        guard let path = localPath(for: logo, variant: variant) else {
          return nil
        }

        guard let base = logosBaseURL() else {
          return nil
        }

        let url = base.appendingPathComponent(path)
        if FileManager.default.fileExists(atPath: url.path) {
          return url
        }

        // Some JSON variants include a leading slash — normalize
        let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let normalized = base.appendingPathComponent(trimmed)

        return FileManager.default.fileExists(atPath: normalized.path) ? normalized : nil
    }

    /// Load platform-native image data for advanced uses.
    public static func data(for logo: CarLogo, variant: Variant) -> Data? {
        guard let url = localURL(for: logo, variant: variant) else {
          return nil
        }

        return try? Data(contentsOf: url)
    }

    /// Optional: remote URLs if you prefer network loading and a smaller app binary.
    public static func remoteURL(for logo: CarLogo, variant: Variant) -> URL? {
        let raw: String?

        switch variant {
        case .thumb:
          raw = logo.image.remoteThumb
        case .optimized:
          raw = logo.image.remoteOptimized
        case .original:
          raw = logo.image.remoteOriginal
        }

        guard let s = raw, let url = URL(string: s) else {
          return nil
        }

        return url
    }
}
