#!/usr/bin/env python3
"""save_hires.py pack/id=<blob-suffix> ... : key a viewer capture (tool-results/mcp-claude-in-chrome-blob-<suffix>.png) and save <pack>/hires/<id>.png (transparent, trimmed)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
import numpy as np
import slice_grid as sg
TR = '/Users/brianterchin/.claude/projects/-Users-brianterchin-Developer-WordRush--claude-worktrees-word-definitions-failing-c540b6/3d60503d-ed25-4482-ad22-5271a6c2134b/tool-results'
HERE = os.path.dirname(os.path.abspath(__file__))
for arg in sys.argv[1:]:
    name, suf = arg.split('=')
    pack, pid = name.split('/')
    src = f'{TR}/mcp-claude-in-chrome-blob-{suf}.png'
    os.makedirs(f'{HERE}/{pack}/hires', exist_ok=True)
    rgba = sg.key_sheet(src, edge_px=3, all_pockets=True, crop=True)
    a = np.asarray(rgba.getchannel('A')) > 24
    ys, xs = np.nonzero(a)
    out = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    out.save(f'{HERE}/{pack}/hires/{pid}.png')
    print(name, out.size)
