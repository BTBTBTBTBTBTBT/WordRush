#!/usr/bin/env python3
"""Neutral white translucent light pieces drawn in CODE (the ChatGPT versions keyed badly against cyan): sunburst fan + spotlight beam,
alpha-only white so the app tints them per game (multiply / tint = game color). Full resolution, no upscaling."""
import math, os
import numpy as np
from PIL import Image, ImageFilter
H = os.path.dirname(os.path.abspath(__file__))
def sunburst(w=2400, h=1200, rays=14):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w / 2, h * 0.98
    ang = np.arctan2(cy - y, x - cx)            # 0..pi upward fan
    r = np.hypot(x - cx, y - cy) / (w / 2)
    band = (np.sin(ang * rays * 1.0 + 0.0) > 0.0).astype(np.float32)
    band = np.asarray(Image.fromarray((band * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))) / 255.0
    fall = np.clip(1.15 - r, 0, 1) ** 1.5
    core = np.exp(-(r * 3.2) ** 2)
    a = np.clip(band * fall * 0.55 + core * 0.55, 0, 1)
    a[ang < 0.05] = 0; a[ang > math.pi - 0.05] = 0; a[y > cy + 4] = 0
    out = np.zeros((h, w, 4), np.uint8); out[..., :3] = 255; out[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')
def spotlight(w=1200, h=1400):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    top_w = w * 0.10; bot_w = w * 0.95
    half = (top_w + (bot_w - top_w) * (y / h)) / 2
    d = np.abs(x - w / 2)
    edge = np.clip((half - d) / (half * 0.35 + 1), 0, 1)
    a = edge * (1 - y / h) ** 1.2 * 0.8
    out = np.zeros((h, w, 4), np.uint8); out[..., :3] = 255; out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')
sunburst().save(f'{H}/out/stage-sunburst.png'); spotlight().save(f'{H}/out/stage-spotlight.png')
