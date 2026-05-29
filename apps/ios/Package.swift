// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WordociousCore",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(name: "WordociousCore", targets: ["WordociousCore"]),
    ],
    targets: [
        .target(
            name: "WordociousCore",
            path: "Sources/Core"
        ),
        .testTarget(
            name: "WordociousCoreTests",
            dependencies: ["WordociousCore"],
            path: "Tests",
            resources: [
                .copy("Fixtures"),
            ]
        ),
    ]
)
