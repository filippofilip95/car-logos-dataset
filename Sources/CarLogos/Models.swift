import Foundation

public struct CarLogo: Decodable, Sendable, Hashable {
    public struct Images: Decodable, Sendable, Hashable {
        // Paths are relative to the `logos/` folder (as shipped in the dataset)
        public let localThumb: String?
        public let localOptimized: String?
        public let localOriginal: String?
        // Remote fallbacks if you prefer network loading
        public let remoteThumb: String?
        public let remoteOptimized: String?
        public let remoteOriginal: String?

        enum CodingKeys: String, CodingKey {
            case localThumb = "localThumb"
            case localOptimized = "localOptimized"
            case localOriginal = "localOriginal"
            case remoteThumb = "thumb"
            case remoteOptimized = "optimized"
            case remoteOriginal = "original"
        }
    }

    public let name: String
    public let slug: String
    public let image: Images
}
