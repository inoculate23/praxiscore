"""Render the same visual code offline, driven by measured demo-audio RMS.
Requires Java 21 and ffmpeg. No Python packages needed.
"""
import math
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import wave

HERE = Path(__file__).resolve().parent
FPS, SECONDS, SIZE, RATE = 30, 12, 768, 48000

ADAPTER = r'''
import java.awt.*;
import java.awt.geom.*;
import java.awt.image.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;

class Canvas {
    int width = SIZE, height = SIZE;
    double clock;
    Graphics2D g;
    Color strokeColor = Color.WHITE, fillColor = Color.WHITE;
    boolean stroked = true, filled = true;
    Path2D shape;
    double millis() { return clock * 1000; }
    public void draw() {}
    Color color(double r, double g, double b, double a) {
        return new Color(clamp(r), clamp(g), clamp(b), clamp(a));
    }
    int clamp(double x) { return (int)Math.max(0, Math.min(255, x)); }
    void background(double grey) {
        g.setComposite(AlphaComposite.Src);
        g.setColor(color(grey, grey, grey, 255));
        g.fillRect(0, 0, width, height);
        g.setComposite(AlphaComposite.SrcOver);
    }
    void noFill() { filled = false; }
    void noStroke() { stroked = false; }
    void stroke(double r, double green, double b, double a) {
        strokeColor = color(r, green, b, a); stroked = true;
    }
    void fill(double r, double green, double b, double a) {
        fillColor = color(r, green, b, a); filled = true;
    }
    void strokeWeight(double n) { g.setStroke(new BasicStroke((float)n)); }
    void beginShape() { shape = new Path2D.Double(); }
    void vertex(double x, double y) {
        if (shape.getCurrentPoint() == null) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    void endShape() { paint(shape); }
    void ellipse(double x, double y, double w, double h) { paint(new Ellipse2D.Double(x,y,w,h)); }
    void paint(Shape s) {
        if (filled) { g.setColor(fillColor); g.fill(s); }
        if (stroked) { g.setColor(strokeColor); g.draw(s); }
    }
}

public class Preview {
    static class Dome extends Canvas {
BODY
    }
    public static void main(String[] args) throws Exception {
        var levels = Files.readAllLines(Path.of(args[0]));
        var dome = new Dome();
        dome.sensitivity = 8; dome.speed = 0.35; dome.brightness = 0.8;
        var frame = new BufferedImage(SIZE, SIZE, BufferedImage.TYPE_3BYTE_BGR);
        dome.g = frame.createGraphics();
        dome.g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        var output = new BufferedOutputStream(System.out, 1024 * 1024);
        for (int n = 0; n < levels.size(); n++) {
            dome.energy = Double.parseDouble(levels.get(n));
            dome.clock = n / 30.0;
            dome.draw();
            output.write(((DataBufferByte)frame.getRaster().getDataBuffer()).getData());
        }
        output.flush(); dome.g.dispose();
    }
}
'''


def main():
    if shutil.which('ffmpeg') is None or shutil.which('javac') is None:
        raise SystemExit('Install ffmpeg and Java 21 to render the preview.')
    # Original synthetic demo score: low pulses, soft fifths, and a ticking overtone.
    samples = []
    for n in range(RATE * SECONDS):
        t = n / RATE
        beat = t % 0.5
        pulse = math.exp(-beat * 18) * math.sin(2 * math.pi * 65 * t)
        pad = (math.sin(2 * math.pi * 130.81 * t) + math.sin(2 * math.pi * 196 * t)) * 0.022
        tick = math.exp(-(t % 0.25) * 85) * math.sin(2 * math.pi * 1568 * t) * 0.045
        fade = min(1, t / 0.5, (SECONDS - t) / 1.0)
        samples.append((pulse * 0.28 + pad + tick) * fade)
    with tempfile.TemporaryDirectory(prefix='praxis-dome-') as folder:
        temp = Path(folder)
        audio = temp / 'demo.wav'
        with wave.open(str(audio), 'wb') as out:
            out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            out.writeframes(b''.join(struct.pack('<h', round(s * 32767)) for s in samples))
        count = RATE // FPS
        levels = [math.sqrt(sum(s*s for s in samples[i:i+count]) / count)
                  for i in range(0, len(samples), count)]
        (temp / 'levels.txt').write_text('\n'.join(str(level) for level in levels))
        body = '\n'.join(line for line in (HERE / 'dome.pxj').read_text().splitlines()
                         if not line.startswith('@P('))
        # Preserve property declarations while removing runtime-only annotations.
        import re
        declarations = '\n'.join(re.sub(r'^@P\(.*?\) @Type.Number\(.*?\) ', '', line)
                                 for line in (HERE / 'dome.pxj').read_text().splitlines()
                                 if line.startswith('@P('))
        source = ADAPTER.replace('SIZE', str(SIZE)).replace('BODY', declarations + '\n' + body)
        (temp / 'Preview.java').write_text(source)
        subprocess.run(['javac', str(temp / 'Preview.java')], check=True)
        renderer = subprocess.Popen(['java', '-Djava.awt.headless=true', '-cp', str(temp), 'Preview',
                                     str(temp / 'levels.txt')], stdout=subprocess.PIPE)
        try:
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pixel_format', 'bgr24',
                            '-video_size', f'{SIZE}x{SIZE}', '-framerate', str(FPS), '-i', 'pipe:0',
                            '-i', str(audio), '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p',
                            '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart',
                            str(HERE / 'preview.mp4')], stdin=renderer.stdout, check=True)
        finally:
            renderer.stdout.close()
            if renderer.wait() != 0:
                raise RuntimeError('Java preview renderer failed')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '5', '-i', str(HERE / 'preview.mp4'),
                    '-frames:v', '1', str(HERE / 'preview.png')], check=True)
    print('Created preview.mp4 and preview.png using measured audio RMS and the dome.pxj drawing code.')


if __name__ == '__main__':
    main()
