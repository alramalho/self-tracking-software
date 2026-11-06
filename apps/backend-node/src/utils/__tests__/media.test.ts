import { describe, expect, it } from "vitest";
import { describeMedia, mediaExtension, mediaKind, onlyImages } from "@tsw/prisma/media";

describe("activity media", () => {
  it("tells photos, videos and voice notes apart by extension", () => {
    expect(mediaKind("https://x.test/a/photos/1.jpg")).toBe("image");
    expect(mediaKind("https://x.test/a/photos/1.MP4?sig=1")).toBe("video");
    expect(mediaKind("https://x.test/a/photos/1.mov")).toBe("video");
    expect(mediaKind("https://x.test/a/photos/1.m4a")).toBe("audio");
    expect(onlyImages(["a.jpg", "b.mp4", "c.m4a", "d.png"])).toEqual(["a.jpg", "d.png"]);
  });

  it("stores a file under an extension that matches its type", () => {
    expect(mediaExtension("IMG_1.MOV", "video/quicktime")).toBe("mov");
    expect(mediaExtension(undefined, "video/mp4")).toBe("mp4");
    expect(mediaExtension("blob", "audio/mp4")).toBe("m4a");
    // A mislabelled name can't make a video show up as a photo.
    expect(mediaExtension("clip.jpg", "video/mp4")).toBe("mp4");
    expect(mediaExtension("photo.heic", "image/heic")).toBe("heic");
    expect(mediaExtension(undefined, "image/jpeg")).toBe("jpg");
  });

  it("names what a friend added", () => {
    expect(describeMedia(["a.jpg"])).toBe("a photo");
    expect(describeMedia(["a.jpg", "b.jpg"])).toBe("photos");
    expect(describeMedia(["a.mp4"])).toBe("a video");
    expect(describeMedia(["a.m4a"])).toBe("a voice note");
    expect(describeMedia(["a.jpg", "b.mp4"])).toBe("photos and clips");
  });
});
