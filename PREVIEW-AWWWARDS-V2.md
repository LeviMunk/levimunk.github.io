# Awwwards-inspired LeviMunk V2 — practice branch

This is an isolated design experiment for the existing recruiter-facing portfolio. The live **main** branch was **not** changed.

## What's different

- Editorial hero with expressive typography, light entrance motion, portrait parallax and botanical ambient lighting.
- Three image-led flagship cases with distinctive visual scenes and mouse/focus interaction.
- Studio photograph and THEØRY's actual logo reused as first-party assets.
- Illustrative analytics and TableOS visual treatments are conceptual artwork, **not real screenshots or extra measured results**.
- Ask My Portfolio remains available after the three flagship projects, instead of interrupting the first impression.
- Controlled scroll reveals and a dark case-study section, without cursor tricks or heavy animation frameworks.
- Phone/tablet, keyboard, and reduced-motion behaviors, all using plain HTML/CSS/JS.

## Preview locally without touching your original folder (fish shell)

```fish
git clone --branch design/awwwards-v2-practice --single-branch https://github.com/LeviMunk/levimunk.github.io.git ~/Downloads/levimunk-v2-preview
cd ~/Downloads/levimunk-v2-preview
python3 -m http.server 8091
```

Visit http://localhost:8091. Ctrl+C stops the server. The live site stays unchanged.

Review at 320px, 390px, 768px, and desktop; try keyboard Tab and reduced-motion preferences. The GitHub Pages production publishing branch is still **main**.

## Design choices

No new project results were invented. The business membership figures and reel reach figures retain the existing caveats in linked case studies. Do not merge until the experiment is explicitly approved.
