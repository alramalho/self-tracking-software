#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


EMOTIONS = [
    "neutral",
    "happy_closed",
    "sad",
    "surprised",
    "angry",
    "thinking",
    "sleepy",
    "wink",
    "skeptical",
    "excited",
    "shy",
    "listening",
    "coach_neutral",
    "coach_speaking",
    "coach_smiling",
    "coach_excited",
]


def is_background(pixel: tuple[int, int, int]) -> bool:
    r, g, b = pixel
    brightness = (r + g + b) / 3
    chroma = max(pixel) - min(pixel)
    return brightness >= 224 and (chroma <= 34 or min(pixel) >= 218)


def remove_connected_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        idx = y * width + x
        if visited[idx] or not is_background(pixels[x, y]):
            return
        visited[idx] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    rgba = rgb.convert("RGBA")
    out = rgba.load()
    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if visited[idx]:
                out[x, y] = (out[x, y][0], out[x, y][1], out[x, y][2], 0)

    return rgba


def content_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return (0, 0, image.width, image.height)
    return bbox


def remove_top_edge_residue(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    remove = bytearray(width * height)

    for start_y in range(height):
        for start_x in range(width):
            start_idx = start_y * width + start_x
            if visited[start_idx] or pixels[start_x, start_y] == 0:
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[start_idx] = 1
            component: list[tuple[int, int]] = []
            left = right = start_x
            top = bottom = start_y

            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)

                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    idx = ny * width + nx
                    if visited[idx] or pixels[nx, ny] == 0:
                        continue
                    visited[idx] = 1
                    queue.append((nx, ny))

            if top <= 22 and bottom <= 42 and (right - left) <= width * 0.45:
                for x, y in component:
                    remove[y * width + x] = 1

    if not any(remove):
        return image

    cleaned = image.copy()
    out = cleaned.load()
    for y in range(height):
        for x in range(width):
            if remove[y * width + x]:
                r, g, b, _ = out[x, y]
                out[x, y] = (r, g, b, 0)
    return cleaned


def remove_lower_background_islands(image: Image.Image) -> Image.Image:
    width, height = image.size
    pixels = image.load()
    visited = bytearray(width * height)
    remove = bytearray(width * height)

    for start_y in range(height):
        for start_x in range(width):
            start_idx = start_y * width + start_x
            if visited[start_idx]:
                continue

            r, g, b, a = pixels[start_x, start_y]
            if not (a > 0 and min(r, g, b) > 210 and max(r, g, b) - min(r, g, b) < 55):
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[start_idx] = 1
            component: list[tuple[int, int]] = []
            left = right = start_x
            top = bottom = start_y

            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)

                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    idx = ny * width + nx
                    if visited[idx]:
                        continue
                    nr, ng, nb, na = pixels[nx, ny]
                    if na > 0 and min(nr, ng, nb) > 210 and max(nr, ng, nb) - min(nr, ng, nb) < 55:
                        visited[idx] = 1
                        queue.append((nx, ny))

            if len(component) >= 180 and top > height * 0.5 and (right - left) < width * 0.35:
                for x, y in component:
                    remove[y * width + x] = 1

    if not any(remove):
        return image

    cleaned = image.copy()
    out = cleaned.load()
    for y in range(height):
        for x in range(width):
            if remove[y * width + x]:
                r, g, b, _ = out[x, y]
                out[x, y] = (r, g, b, 0)
    return cleaned


def normalize(image: Image.Image, size: int, padding: int) -> Image.Image:
    bbox = content_bbox(image)
    cropped = image.crop(bbox)
    target = size - padding * 2
    scale = min(target / cropped.width, target / cropped.height)
    resized = cropped.resize(
        (round(cropped.width * scale), round(cropped.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    canvas.alpha_composite(
        resized,
        ((size - resized.width) // 2, (size - resized.height) // 2),
    )
    return canvas


def split_sheet(source: Path, output_dir: Path, avatar: str, size: int, padding: int) -> None:
    sheet = Image.open(source).convert("RGB")
    output_dir.mkdir(parents=True, exist_ok=True)

    for index, emotion in enumerate(EMOTIONS):
        row, col = divmod(index, 4)
        left = round(col * sheet.width / 4)
        upper = round(row * sheet.height / 4)
        right = round((col + 1) * sheet.width / 4)
        lower = round((row + 1) * sheet.height / 4)

        cell = sheet.crop((left, upper, right, lower))
        transparent = remove_connected_background(cell)
        transparent = remove_top_edge_residue(transparent)
        normalized = normalize(transparent, size=size, padding=padding)
        normalized = remove_lower_background_islands(normalized)
        normalized.save(output_dir / f"{index + 1:02d}_{emotion}.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=Path("../design/avatars"))
    parser.add_argument("--output-dir", type=Path, default=Path("../design/avatars"))
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--padding", type=int, default=44)
    args = parser.parse_args()

    for avatar in ("bulky", "helly"):
        split_sheet(
            args.source_dir / f"{avatar}_positions.png",
            args.output_dir / avatar,
            avatar,
            size=args.size,
            padding=args.padding,
        )


if __name__ == "__main__":
    main()
