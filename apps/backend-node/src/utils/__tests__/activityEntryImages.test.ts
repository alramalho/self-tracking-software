import { describe, expect, it } from "vitest";
import { buildActivityEntryImageUpdate } from "../activityEntryImages";

describe("buildActivityEntryImageUpdate", () => {
  it("appends uploaded images while preserving legacy first-image fields", () => {
    const update = buildActivityEntryImageUpdate(
      {
        imageUrl: "https://cdn.example.com/old.jpg",
        imageS3Path: "/users/u1/activity_entries/e1/photos/old.jpg",
        imageUrls: [],
        imageS3Paths: [],
      },
      [
        {
          url: "https://cdn.example.com/new-1.jpg",
          s3Path: "/users/u1/activity_entries/e1/photos/new-1.jpg",
        },
        {
          url: "https://cdn.example.com/new-2.jpg",
          s3Path: "/users/u1/activity_entries/e1/photos/new-2.jpg",
        },
      ],
      true
    );

    expect(update.imageUrl).toBe("https://cdn.example.com/old.jpg");
    expect(update.imageS3Path).toBe(
      "/users/u1/activity_entries/e1/photos/old.jpg"
    );
    expect(update.imageUrls).toEqual([
      "https://cdn.example.com/old.jpg",
      "https://cdn.example.com/new-1.jpg",
      "https://cdn.example.com/new-2.jpg",
    ]);
    expect(update.imageS3Paths).toEqual([
      "/users/u1/activity_entries/e1/photos/old.jpg",
      "/users/u1/activity_entries/e1/photos/new-1.jpg",
      "/users/u1/activity_entries/e1/photos/new-2.jpg",
    ]);
    expect(update.imageExpiresAt).toBeNull();
    expect(update.imageCreatedAt).toBeInstanceOf(Date);
    expect(update.imageIsPublic).toBe(true);
  });

  it("sets legacy fields from the first uploaded image when none exists", () => {
    const update = buildActivityEntryImageUpdate(
      {},
      [
        {
          url: "https://cdn.example.com/first.jpg",
          s3Path: "/users/u1/activity_entries/e1/photos/first.jpg",
        },
      ],
      false
    );

    expect(update.imageUrl).toBe("https://cdn.example.com/first.jpg");
    expect(update.imageS3Path).toBe(
      "/users/u1/activity_entries/e1/photos/first.jpg"
    );
    expect(update.imageUrls).toEqual(["https://cdn.example.com/first.jpg"]);
    expect(update.imageS3Paths).toEqual([
      "/users/u1/activity_entries/e1/photos/first.jpg",
    ]);
    expect(update.imageIsPublic).toBe(false);
  });
});
