// Validate the actual PNG saved by the native share sheet, not a preview screenshot.
// Usage: swift e2e/native/verify-workout-share.swift export.png portrait|landscape 3|6
import Foundation
import CoreGraphics
import ImageIO
import Vision

func require(_ condition: Bool, _ message: String) {
    guard condition else { fputs("\(message)\n", stderr); exit(1) }
}
let args = CommandLine.arguments
require(args.count == 4, "Expected PNG path, orientation and stat count")
let url = URL(fileURLWithPath: args[1])
let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
require(CGImageSourceGetType(source) as String? == "public.png", "Export must be a PNG")
let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
let width = image.width, height = image.height
let six = args[3] == "6"
let expectedRatio = args[2] == "portrait" ? 360.0 / (six ? 430 : 360) : 520.0 / (six ? 260 : 210)
require(abs(Double(width) / Double(height) - expectedRatio) < 0.015, "Incorrect canvas aspect ratio")
require(width >= 700, "Export resolution is too low")
let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
let pixels = context.data!.assumingMemoryBound(to: UInt8.self)
var coloredPixels = 0
for y in 0..<height {
    for x in 0..<width {
        let i = (y * width + x) * 4
        let alpha = pixels[i + 3]
        if x < 3 || y < 3 || x >= width - 3 || y >= height - 3 {
            require(alpha < 10, "Content touches the canvas edge at \(x),\(y)")
        }
        if alpha > 100 && Int(pixels[i]) - Int(pixels[i + 2]) > 50 { coloredPixels += 1 }
    }
}
require(coloredPixels > 500, "Route/endpoint pixels missing")
// Recognize text against dark, then verify the same regions retain contrast
// on white. OCR alone is unreliable for white glyphs with a dark outline.
context.setFillColor(CGColor(gray: 0.12, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: height))
context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
let dark = context.makeImage()!
var observations: [VNRecognizedTextObservation] = []
for level in [VNRequestTextRecognitionLevel.accurate, .fast] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = level
    request.usesLanguageCorrection = false
    do { try VNImageRequestHandler(cgImage: dark).perform([request]) }
    catch { fputs("OCR failed: \(error)\n", stderr); exit(1) }
    observations += request.results ?? []
}
let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ").lowercased()
var expected = ["distance", "time", "pace", "5.10", "30", "5:53", "tracking.so"]
if six { expected += ["elevation", "heart rate", "calories", "96", "151", "439"] }
for value in expected { require(text.contains(value), "Missing exported text: \(value). OCR: \(text)") }
context.setFillColor(CGColor(gray: 1, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: height))
context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
let white = context.makeImage()!
for value in expected {
    let observation = observations.first { $0.topCandidates(1).first?.string.lowercased().contains(value) == true }!
    let box = observation.boundingBox
    require(box.minX > 0.01 && box.maxX < 0.99 && box.minY > 0.01 && box.maxY < 0.99, "Text reaches canvas edge")
    let left = max(0, Int(box.minX * Double(width)) - 2)
    let right = min(width, Int(box.maxX * Double(width)) + 2)
    let top = max(0, Int((1 - box.maxY) * Double(height)) - 2)
    let bottom = min(height, Int((1 - box.minY) * Double(height)) + 2)
    var contrasting = 0
    for y in top..<bottom {
        for x in left..<right {
            let i = (y * width + x) * 4
            if min(pixels[i], pixels[i+1], pixels[i+2]) < 210 { contrasting += 1 }
        }
    }
    require(Double(contrasting) / Double((right-left)*(bottom-top)) > 0.02, "Text disappears on white: \(value)")
}
for (name, composite) in [("dark", dark), ("white", white)] {
    let previewURL = url.deletingPathExtension().appendingPathExtension("\(name).png")
    let destination = CGImageDestinationCreateWithURL(previewURL as CFURL, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, composite, nil)
    require(CGImageDestinationFinalize(destination), "Could not write QA image")
}
print("Verified \(url.lastPathComponent): \(width)×\(height), transparent edges, route, \(args[3]) stats, watermark, and text contrast on white. OCR: \(text)")
