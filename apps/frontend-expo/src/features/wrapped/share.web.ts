import type { ShareStoryInput } from "./types";
export async function shareStory({ view, year }: ShareStoryInput) {
  const { toPng } = await import("html-to-image");
  if (!view.current) throw new Error("The story is still loading.");
  const url = await toPng(view.current as unknown as HTMLElement, {
    pixelRatio: 2,
    cacheBust: true,
  });
  const file = new File(
    [await (await fetch(url)).blob()],
    `wrapped-${year}.png`,
    { type: "image/png" },
  );
  if (navigator.canShare?.({ files: [file] }))
    await navigator.share({ files: [file], title: `My ${year} Wrapped` });
  else {
    const link = document.createElement("a");
    link.download = file.name;
    link.href = url;
    link.click();
  }
}
