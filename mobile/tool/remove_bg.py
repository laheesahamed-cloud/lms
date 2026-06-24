#!/usr/bin/env python3
"""Make the near-white background of the onboarding illustration transparent.

Flood-fills from the image edges so interior whites (lab coats) are kept.
Usage: python3 tool/remove_bg.py assets/medical/team_raw.png assets/medical/team.png
"""
import sys
from collections import deque
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else "assets/medical/team_raw.png"
dst = sys.argv[2] if len(sys.argv) > 2 else "assets/medical/team.png"
THRESH = 236  # pixels brighter than this (all channels) count as background

im = Image.open(src).convert("RGBA")
w, h = im.size
px = im.load()


def is_bg(x, y):
    r, g, b, a = px[x, y]
    return r >= THRESH and g >= THRESH and b >= THRESH


seen = [[False] * w for _ in range(h)]
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if is_bg(x, y) and not seen[y][x]:
            seen[y][x] = True
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if is_bg(x, y) and not seen[y][x]:
            seen[y][x] = True
            q.append((x, y))

while q:
    x, y = q.popleft()
    px[x, y] = (255, 255, 255, 0)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_bg(nx, ny):
            seen[ny][nx] = True
            q.append((nx, ny))

im.save(dst)
print(f"Wrote {dst} ({w}x{h}) — transparent background")
