import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
    fputs("usage: swift flatten_app_icon.swift INPUT.png OUTPUT.png\n", stderr)
    exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard
    let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else {
    fputs("error: could not read input image\n", stderr)
    exit(65)
}

guard let context = CGContext(
    data: nil,
    width: image.width,
    height: image.height,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
    fputs("error: could not create opaque image context\n", stderr)
    exit(70)
}

let bounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
context.setFillColor(CGColor(red: 0.02, green: 0.02, blue: 0.02, alpha: 1))
context.fill(bounds)
context.draw(image, in: bounds)

guard
    let flattenedImage = context.makeImage(),
    let destination = CGImageDestinationCreateWithURL(
        outputURL as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    )
else {
    fputs("error: could not create output image\n", stderr)
    exit(70)
}

CGImageDestinationAddImage(destination, flattenedImage, nil)
guard CGImageDestinationFinalize(destination) else {
    fputs("error: could not write output image\n", stderr)
    exit(74)
}
