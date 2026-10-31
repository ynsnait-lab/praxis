// swift-tools-version: 5.9
// Praxis Rappels : l'agent de barre des menus qui rappelle de pratiquer sur Praxis.
// Construit par build.sh (./praxis rappels), qui en fait une vraie app installée dans Applications.
import PackageDescription

let package = Package(
    name: "PraxisRappels",
    defaultLocalization: "fr",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "PraxisRappels",
            path: "Sources/PraxisRappels"
        )
    ]
)
