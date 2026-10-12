# Lifelly Motions

Lifelly Motions is a desktop ambient visualizer inspired by live wallpaper apps. It creates a smooth animated cinematic background with particles, glow, waves, and a modern control panel.

Features:
- Fullscreen animated background
- Multiple visual modes: Aurora, Neon Pulse, Galaxy Drift, Ocean Pulse
- Adjustable motion speed, glow intensity and particle density
- Overlay control panel for quick customization
- Keyboard shortcuts: F1 show/hide controls, Esc quit
- Windows-friendly desktop UI

Requirements:
- Python 3.10+
- PyQt6

Install:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Build EXE for Windows:
```bash
pip install pyinstaller
pyinstaller --onefile --noconsole --name LifellyMotions main.py
```

Notes:
- This is a desktop visualizer app and works best as a fullscreen ambient app.
- For a true system wallpaper integration on Windows, additional OS-level desktop shell integration may be required.
