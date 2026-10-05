"""Integrated fit check (extends ../fit-check.py for layered parts). For a builder's layers on a body:

  face    eyes + mouth covered by front/held layers            ≤ 1%
  letter  the initial covered by front/held layers             ≤ 1%
  seat    front layers sitting on the body (not floating)      ≥ 55% of their pixels over the body
          (a tail / held item: ≥ 15%)
  grip    held items: the hand covers part of the item (2–50%) and the item touches the hand
  back    back layers: ≥ 25% hidden behind the body (it is BEHIND) and 4–65% of the tile visible
          beside / above the body (it reads, but doesn't swallow the mascot)
  frame   the whole composition fits a square with the body ≥ 50% of it (fit.minBody)
"""
import numpy as np
from rig import rig, U, alpha
from pieces import guards


def check(body, L):
    R = rig(body)
    A = R['A']
    face, letter = guards(body)
    res, fails = {}, []
    covers = np.zeros_like(A)
    for im in list(L.get('front', ())) + list(L.get('held', ())):
        covers |= alpha(im) > 0.35
    res['face'] = float((covers & face).sum() / max(1, face.sum()))
    res['letter'] = float((covers & letter).sum() / max(1, letter.sum()))
    if res['face'] > 0.01:
        fails.append('covers face %.3f' % res['face'])
    if res['letter'] > 0.01:
        fails.append('covers letter %.3f' % res['letter'])
    seats = []
    for im in L.get('front', ()):
        m = alpha(im) > 0.35
        if m.sum():
            seats.append(float((m & A).sum() / m.sum()))
    if seats:
        res['seat'] = min(seats)
        need = L.get('seat_min', 0.55)
        if res['seat'] < need:
            fails.append('floats %.2f' % res['seat'])
    hm = np.zeros_like(A)
    for s in L.get('handover', ()):
        hm |= R['arms'][s]['mask']
    for im in L.get('held', ()):
        m = alpha(im) > 0.35
        g = float((m & hm).sum() / max(1, m.sum()))
        res['grip'] = g
        if not (0.02 <= g <= 0.5):
            fails.append('grip %.2f' % g)
    for im in L.get('back', ()):
        m = alpha(im) > 0.35
        n = max(1, m.sum())
        hidden = float((m & A).sum() / n)
        vis = float((m & ~A).sum() / max(1, A.sum()))
        res['back_hidden'], res['back_visible'] = hidden, vis
        if hidden < 0.25:
            fails.append('not behind %.2f' % hidden)
        if not (0.04 <= vis <= 0.65):
            fails.append('back visible %.2f' % vis)
    allm = A.copy()
    for k in ('back', 'front', 'held'):
        for im in L.get(k, ()):
            allm |= alpha(im) > 0.1
    ys, xs = np.nonzero(allm)
    side = max(ys.max() - ys.min(), xs.max() - xs.min()) / 0.9
    res['bodyScale'] = float(U / side)
    if res['bodyScale'] < 0.5:
        fails.append('frame %.2f' % res['bodyScale'])
    return {k: round(v, 3) for k, v in res.items()}, fails
