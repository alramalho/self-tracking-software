"""3D coach faces with a mood (sad, smiling) for the coach's notes, edited from the clay figures.
Same local runtime as the other art (~/workspace/sticker-gen: Qwen-Image-2.1 + Pruna 8-step LoRA).
Reference: the 3D figure only; a flat face as a second reference turned the clay brown and grainy.

    ~/workspace/sticker-gen/.venv/bin/python scripts/onboarding-art/coach-moods.py [seeds]
"""
import logging, os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path.home() / "workspace/sticker-gen"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
import generate as generator
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
COACHES = ROOT / "apps/frontend-expo/assets/coaches"
FLAT = ROOT / "apps/frontend-vite/public/images/coaches"
OUT = Path(os.environ.get("OUT", COACHES / "candidates"))
MOODS = {
    "sad": ("03_sad", "sad and a little worried: inner eyebrows raised, eyes looking slightly down, a small downturned frown"),
    "smiling": ("15_coach_smiling", "happy: a warm open smile, cheerful eyes"),
}
COLOURS = {
    "helly": "warm coral salmon-pink",
    "oli": "neutral medium grey",
}
PROMPT = (
    "This is an RGBA image with transparency. Edit this image: keep the exact same 3D character, same {colour} colour "
    "on the head and body, same smooth soft matte surface with no texture or grain, same head shape, body, soft studio "
    "lighting, framing and camera angle. Change only the facial expression so the character looks {mood}. "
    "One centered character, fully visible. No text, no background, no ground shadow. "
    "The image has alpha channel and the background is transparent."
)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    seeds = [int(x) for x in (sys.argv[1].split(",") if len(sys.argv) > 1 else ["7"])]
    OUT.mkdir(parents=True, exist_ok=True)
    pipe = generator.load_pipeline("mps", True, 8, False)
    for coach in ["helly", "oli"]:
        figure = Image.open(COACHES / f"{coach}-3d.png").convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
        for mood, (flat, words) in MOODS.items():
            for seed in seeds:
                started = time.time()
                raw = pipe(prompt=PROMPT.format(mood=words, colour=COLOURS[coach]), image=[figure], width=1024, height=1024,
                           num_inference_steps=8, generator=torch.Generator("cpu").manual_seed(seed),
                           sigmas=generator.PRUNA_SIGMAS[8], true_cfg_scale=1.0).images[0].convert("RGBA")
                image = generator.trim_and_square(raw, 384, margin=0.06)
                target = OUT / f"{coach}-3d-{mood}-seed{seed}.png"
                image.save(target, optimize=True)
                logging.info("saved %s in %ds alpha=%s", target.name, time.time() - started, generator.alpha_stats(image))
