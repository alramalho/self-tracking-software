"""One more clay hero icon for the onboarding: a "?" for the questions the coach writes itself.
Same local runtime as the other art (~/workspace/sticker-gen: Qwen-Image-2.1 + Pruna 8-step LoRA)."""
import json, logging, os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path.home() / "workspace/sticker-gen"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
import generate as generator
import torch

OUT = Path(__file__).resolve().parents[2] / "apps/frontend-expo/assets/onboarding"
SUBJECT = "one chunky question mark made of smooth soft rounded royal blue clay, with a round dot below it"
STYLE = (
    "This is an RGBA image with transparency. A 3D clay icon of {subject}. Airbnb-style 3D illustration: "
    "isometric three-quarter view, soft rounded forms, matte clay material, simple friendly shape, "
    "gentle soft studio lighting with smooth shading inside the form only. One centered icon, isolated and "
    "fully visible. No text, no letters, no background tile, no ground shadow, no sparkles. "
    "The image has alpha channel and the background is transparent."
)
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    seeds = [int(x) for x in (sys.argv[1].split(",") if len(sys.argv) > 1 else ["42"])]
    pipe = generator.load_pipeline("mps", True, 8, False)
    for seed in seeds:
        started = time.time()
        raw = pipe(prompt=STYLE.format(subject=SUBJECT), width=1024, height=1024, num_inference_steps=8,
                   generator=torch.Generator("cpu").manual_seed(seed), sigmas=generator.PRUNA_SIGMAS[8],
                   true_cfg_scale=1.0, use_kv_cache=True).images[0].convert("RGBA")
        image = generator.trim_and_square(raw, 384, margin=0.1)
        target = OUT / (f"question-seed{seed}.png")
        image.save(target, optimize=True)
        logging.info("saved %s in %ds alpha=%s", target.name, time.time() - started, generator.alpha_stats(image))
