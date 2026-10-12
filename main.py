import math
import random
import sys
from dataclasses import dataclass

from PyQt6.QtCore import Qt, QTimer, QPointF
from PyQt6.QtGui import QColor, QFont, QLinearGradient, QPainter, QPainterPath, QPen, QRadialGradient
from PyQt6.QtWidgets import QApplication, QComboBox, QHBoxLayout, QLabel, QPushButton, QSlider, QWidget, QVBoxLayout


@dataclass
class Particle:
    x: float
    y: float
    vx: float
    vy: float
    radius: float
    color: QColor
    alpha: float


THEMES = {
    "Aurora": [QColor(86, 198, 255), QColor(162, 92, 255), QColor(38, 218, 130)],
    "Neon Pulse": [QColor(255, 105, 180), QColor(152, 78, 255), QColor(0, 221, 255)],
    "Galaxy Drift": [QColor(110, 82, 255), QColor(255, 112, 166), QColor(18, 214, 199)],
    "Ocean Pulse": [QColor(18, 120, 255), QColor(72, 220, 255), QColor(8, 196, 156)],
}


class LifellyPanel(QWidget):
    def __init__(self, parent):
        super().__init__(parent)
        self.setObjectName("control_panel")
        self.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        self.setStyleSheet(
            """
            QWidget#control_panel {
                background: rgba(8, 12, 20, 185);
                border: 1px solid rgba(255,255,255,22);
                border-radius: 20px;
            }
            QLabel { color: #eaf3ff; }
            QComboBox, QSlider {
                background: rgba(255,255,255,8);
                border: 1px solid rgba(255,255,255,16);
                border-radius: 10px;
                color: #f1f7ff;
                padding: 6px 10px;
            }
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #7dd3fc, stop:1 #8b5cf6);
                color: white;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                padding: 8px 14px;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #a5f3fc, stop:1 #a78bfa);
            }
            QSlider::groove:horizontal {
                height: 6px;
                background: rgba(255,255,255,18);
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #b9f2ff;
                width: 16px;
                height: 16px;
                margin: -5px 0;
                border-radius: 8px;
            }
            """
        )

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        title = QLabel("Lifelly Motions")
        title.setFont(QFont("Segoe UI", 18, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        self.theme_combo = QComboBox()
        self.theme_combo.addItems(list(THEMES.keys()))
        self.theme_combo.setCurrentText("Aurora")
        layout.addWidget(self.theme_combo)

        speed_label = QLabel("Motion speed")
        layout.addWidget(speed_label)
        self.speed_slider = QSlider(Qt.Orientation.Horizontal)
        self.speed_slider.setRange(20, 220)
        self.speed_slider.setValue(90)
        layout.addWidget(self.speed_slider)

        glow_label = QLabel("Glow intensity")
        layout.addWidget(glow_label)
        self.glow_slider = QSlider(Qt.Orientation.Horizontal)
        self.glow_slider.setRange(20, 200)
        self.glow_slider.setValue(120)
        layout.addWidget(self.glow_slider)

        particles_label = QLabel("Particle density")
        layout.addWidget(particles_label)
        self.particle_slider = QSlider(Qt.Orientation.Horizontal)
        self.particle_slider.setRange(20, 200)
        self.particle_slider.setValue(90)
        layout.addWidget(self.particle_slider)

        self.toggle_button = QPushButton("Hide controls")
        self.toggle_button.clicked.connect(parent.toggle_panel)
        layout.addWidget(self.toggle_button)

        self.theme_combo.currentTextChanged.connect(parent.set_theme)


class LifellyMotions(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Lifelly Motions")
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WidgetAttribute.WA_AlwaysStackOnTop, True)
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)

        self.time = 0.0
        self.theme_name = "Aurora"
        self.speed = 0.9
        self.glow = 1.2
        self.particle_density = 1.0

        self.particles = []
        self._build_particles()

        self.panel = LifellyPanel(self)
        self.panel.resize(300, 420)
        self.panel.move(30, 60)
        self.panel.raise_()
        self.panel.show()

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.animate)
        self.timer.start(16)

        self.resize(self.screen().availableGeometry().size())

    def _build_particles(self):
        w, h = self.screen().availableGeometry().size().width(), self.screen().availableGeometry().size().height()
        for _ in range(120):
            self.particles.append(
                Particle(
                    x=random.uniform(0, w),
                    y=random.uniform(0, h),
                    vx=random.uniform(-0.8, 0.8),
                    vy=random.uniform(-0.4, 0.4),
                    radius=random.uniform(1.2, 4.8),
                    color=QColor(random.randint(120, 255), random.randint(120, 255), random.randint(180, 255), 180),
                    alpha=random.uniform(0.3, 0.9),
                )
            )

    def set_theme(self, name):
        self.theme_name = name

    def toggle_panel(self):
        if self.panel.isVisible():
            self.panel.hide()
            self.panel.toggle_button.setText("Show controls")
        else:
            self.panel.show()
            self.panel.toggle_button.setText("Hide controls")

    def animate(self):
        self.time += 0.018 * self.speed * 1.8
        self.speed = self.panel.speed_slider.value() / 100
        self.glow = self.panel.glow_slider.value() / 100
        self.particle_density = self.panel.particle_slider.value() / 100

        for p in self.particles:
            p.x += p.vx * (0.5 + self.speed)
            p.y += p.vy * (0.5 + self.speed)
            if p.x < 0 or p.x > self.width():
                p.vx *= -1
            if p.y < 0 or p.y > self.height():
                p.vy *= -1

        self.update()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_F1:
            self.toggle_panel()
        elif event.key() == Qt.Key.Key_Escape:
            self.close()

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.RightButton:
            self.close()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        rect = self.rect()
        w, h = rect.width(), rect.height()

        colors = THEMES.get(self.theme_name, THEMES["Aurora"])
        gradient = QLinearGradient(0, 0, w, h)
        gradient.setColorAt(0.0, colors[0].darker(140))
        gradient.setColorAt(0.5, colors[1].darker(180))
        gradient.setColorAt(1.0, colors[2].darker(150))
        painter.fillRect(rect, gradient)

        for i in range(4):
            cx = w * (0.2 + i * 0.23) + math.sin(self.time * (0.7 + i * 0.2)) * 90
            cy = h * (0.24 + (i % 2) * 0.45) + math.cos(self.time * (1.1 + i * 0.15)) * 70
            radius = 220 + i * 70
            glow = QRadialGradient(cx, cy, 10, cx, cy)
            glow.setColorAt(0.0, colors[i % 3].withAlpha(180))
            glow.setColorAt(0.3, colors[(i + 1) % 3].withAlpha(90))
            glow.setColorAt(1.0, QColor(0, 0, 0, 0))
            painter.setBrush(glow)
            painter.setPen(Qt.PenStyle.NoPen)
            painter.drawEllipse(int(cx - radius), int(cy - radius), radius * 2, radius * 2)

        for idx, p in enumerate(self.particles[: int(len(self.particles) * (0.35 + self.particle_density * 0.8))]):
            alpha = int(p.alpha * 255)
            color = QColor(p.color)
            color.setAlpha(alpha)
            painter.setPen(Qt.PenStyle.NoPen)
            painter.setBrush(color)
            painter.drawEllipse(int(p.x), int(p.y), max(1, int(p.radius)), max(1, int(p.radius)))

        wave_color = colors[2].lighter(140)
        wave_color.setAlpha(120)
        painter.setPen(QPen(wave_color, 2))
        for offset in range(3):
            path = QPainterPath()
            start_y = h * (0.52 + offset * 0.12)
            for x in range(0, w + 20, 20):
                y = start_y + math.sin((x * 0.02) + self.time * (1.4 + offset * 0.2)) * (50 + offset * 20)
                if x == 0:
                    path.moveTo(x, y)
                else:
                    path.lineTo(x, y)
            painter.drawPath(path)

        title = "Lifelly Motions"
        painter.setPen(QColor(255, 255, 255, 220))
        painter.setFont(QFont("Segoe UI", 34, QFont.Weight.Bold))
        painter.drawText(
            int(w * 0.5 - 170),
            int(h * 0.5 - 90),
            340,
            120,
            Qt.AlignmentFlag.AlignCenter,
            title,
        )

        subtitle = "Ambient motion system"
        painter.setPen(QColor(225, 233, 255, 170))
        painter.setFont(QFont("Segoe UI", 14, QFont.Weight.Normal))
        painter.drawText(
            int(w * 0.5 - 150),
            int(h * 0.5 - 20),
            300,
            60,
            Qt.AlignmentFlag.AlignCenter,
            subtitle,
        )

        painter.end()


def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Lifelly Motions")
    window = LifellyMotions()
    screen = app.primaryScreen().availableGeometry()
    window.setGeometry(screen)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
