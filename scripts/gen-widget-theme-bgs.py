#!/usr/bin/env python3
"""Item 25: the Android widget's theme walls (res/drawable/widget_bg_theme_<id>.xml) generated from
packages/core/src/theme-registry.json (a RemoteViews background has to be a drawable resource).
Run from the repo root after the registry's wall stops change: python3 scripts/gen-widget-theme-bgs.py"""
import json
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
reg = json.load(open(os.path.join(ROOT, 'packages/core/src/theme-registry.json')))
out = os.path.join(ROOT, 'apps/android/app/src/main/res/drawable')
for t in reg['themes']:
    if t['id'] == 'default':
        continue
    w = (t['light'] or t['dark'])['wall']
    open(os.path.join(out, 'widget_bg_theme_%s.xml' % t['id']), 'w').write('''<?xml version="1.0" encoding="utf-8"?>
<!-- GENERATED from packages/core/src/theme-registry.json (item 25): the %s theme's widget wall. Regenerate with
     scripts/gen-widget-theme-bgs.py when the registry's wall stops change. -->
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:angle="270"
        android:startColor="%s"
        android:centerColor="%s"
        android:endColor="%s" />
    <corners android:radius="@dimen/widget_radius" />
</shape>
''' % (t['id'], '#FF' + w[0][1:], '#FF' + w[1][1:], '#FF' + w[2][1:]))
print('widget theme walls written')
