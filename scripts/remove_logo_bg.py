"""Remove edge-connected black background from brand logo; keep crest shadows."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SRC = Path(
    r"C:\Users\mailg\.cursor\projects\c-Users-mailg-fantacalcetto\assets"
    r"\c__Users_mailg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
    r"_ChatGPT_Image_1_ago_2026__19_33_11-239e2619-9799-41c5-b3a7-5c749f943f11.png"
)
OUT = Path(__file__).resolve().parents[1] / "public" / "brand" / "logo.png"
CHECKER = Path(__file__).resolve().parents[1] / "tmp-logo-checker.png"

HARD = 18.0
SOFT = 48.0


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    arr = np.array(im).astype(np.float32)
    h, w = arr.shape[:2]
    lum = arr[:, :, :3].mean(axis=2)

    bg = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def maybe_seed(y: int, x: int) -> None:
        if lum[y, x] <= SOFT and not bg[y, x]:
            bg[y, x] = True
            q.append((y, x))

    for x in range(w):
        maybe_seed(0, x)
        maybe_seed(h - 1, x)
    for y in range(h):
        maybe_seed(y, 0)
        maybe_seed(y, w - 1)

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and lum[ny, nx] <= SOFT:
                bg[ny, nx] = True
                q.append((ny, nx))

    alpha = np.full((h, w), 255.0, dtype=np.float32)
    alpha[bg & (lum <= HARD)] = 0.0
    fringe = bg & (lum > HARD) & (lum <= SOFT)
    alpha[fringe] = ((lum[fringe] - HARD) / (SOFT - HARD)) * 255.0

    out = arr.copy()
    out[:, :, 3] = alpha
    fully = alpha <= 0.5
    out[fully, 0:3] = 0

    yy, xx = np.where((lum < 35) & (alpha > 10) & (alpha < 255))
    for y, x in zip(yy, xx, strict=False):
        neighbors = []
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w:
                neighbors.append(alpha[ny, nx])
        if neighbors and min(neighbors) < 1:
            out[y, x, 3] = max(0.0, min(255.0, (lum[y, x] / 35.0) * 255.0))
            if out[y, x, 3] < 1:
                out[y, x, 0:3] = 0

    result = Image.fromarray(out.astype(np.uint8), "RGBA")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    result.save(OUT, optimize=True)

    v = np.array(Image.open(OUT).convert("RGBA"))
    corners = [tuple(int(c) for c in v[y, x]) for y, x in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1))]
    trans = int((v[:, :, 3] == 0).sum())
    partial = int(((v[:, :, 3] > 0) & (v[:, :, 3] < 255)).sum())
    opaque_n = int((v[:, :, 3] == 255).sum())
    black_opaque = int(
        ((v[:, :, 0] < 10) & (v[:, :, 1] < 10) & (v[:, :, 2] < 10) & (v[:, :, 3] == 255)).sum()
    )
    print("corners", corners)
    print("trans", trans, "partial", partial, "opaque", opaque_n)
    print("black_opaque", black_opaque)
    print("saved", OUT, "bytes", OUT.stat().st_size)

    chk = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(chk)
    tile = 32
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            c = (210, 210, 210, 255) if ((x // tile) + (y // tile)) % 2 == 0 else (255, 255, 255, 255)
            draw.rectangle([x, y, x + tile - 1, y + tile - 1], fill=c)
    Image.alpha_composite(chk, result).save(CHECKER)
    print("checker", CHECKER)


if __name__ == "__main__":
    main()
