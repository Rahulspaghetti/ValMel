import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';

// --- Interfaces ---

interface BackgroundStar {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;       // trail length in pixels
  speed: number;
  opacity: number;
  width: number;        // stroke width
  life: number;         // 0 → 1, how far along its lifespan
  lifeSpeed: number;    // how fast life progresses per frame
  hue: number;          // slight colour variation around white-blue
}

@Component({
  selector: 'app-shooting-stars',
  standalone: true,
  template: `<canvas #canvas></canvas>`,
  styles: [`
    :host {
      display: block;
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      /* sit behind everything else */
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShootingStarsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animFrameId = 0;
  private backgroundStars: BackgroundStar[] = [];
  private shootingStars: ShootingStar[] = [];

  // Tuning constants
  private readonly BG_STAR_COUNT = 220;
  private readonly SHOOTING_STAR_MAX = 6;
  private readonly SHOOTING_STAR_SPAWN_CHANCE = 0.012; // per frame chance to spawn one

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.resize();
    this.generateBackgroundStars();
    this.startLoop();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resize();
    // Regenerate stars to match new canvas size
    this.generateBackgroundStars();
  }

  // --- Setup ---

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    // Use device pixel ratio for sharp rendering on HiDPI displays
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private get W(): number {
    return this.canvasRef.nativeElement.clientWidth || window.innerWidth;
  }

  private get H(): number {
    return this.canvasRef.nativeElement.clientHeight || window.innerHeight;
  }

  private generateBackgroundStars(): void {
    this.backgroundStars = [];
    for (let i = 0; i < this.BG_STAR_COUNT; i++) {
      const baseOpacity = Math.random() * 0.55 + 0.2;
      this.backgroundStars.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        radius: Math.random() * 1.2 + 0.3,
        baseOpacity,
        opacity: baseOpacity,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  // --- Shooting star factory ---

  private spawnShootingStar(): ShootingStar {
    const W = this.W;
    const H = this.H;

    // Spawn from the top or left edges, travel diagonally down-right
    // with a bit of angle variance for variety
    const edge = Math.random() < 0.6 ? 'top' : 'left';
    let x: number, y: number;

    if (edge === 'top') {
      x = Math.random() * W * 1.2 - W * 0.1;
      y = -20;
    } else {
      x = -20;
      y = Math.random() * H * 0.7;
    }

    // Angle between ~20° and ~60° below horizontal (in radians)
    const angleRad = (Math.random() * 40 + 20) * (Math.PI / 180);
    const speed = Math.random() * 8 + 6;

    return {
      x,
      y,
      vx: Math.cos(angleRad) * speed,
      vy: Math.sin(angleRad) * speed,
      length: Math.random() * 120 + 60,
      speed,
      opacity: 1,
      width: Math.random() * 1.5 + 0.5,
      life: 0,
      lifeSpeed: Math.random() * 0.008 + 0.004,
      hue: Math.random() * 40 - 20, // -20 to +20 degrees around 200 (blue-white)
    };
  }

  // --- Animation loop ---

  private startLoop(): void {
    const tick = () => {
      this.drawFrame();
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private drawFrame(): void {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    // Deep space background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    this.drawBackgroundStars();
    this.maybeSpawnShootingStar();
    this.drawAndUpdateShootingStars();
  }

  // --- Background stars ---

  private drawBackgroundStars(): void {
    const ctx = this.ctx;

    for (const star of this.backgroundStars) {
      // Advance twinkle phase
      star.twinklePhase += star.twinkleSpeed;
      star.opacity = star.baseOpacity + Math.sin(star.twinklePhase) * 0.18;
      star.opacity = Math.max(0.05, Math.min(1, star.opacity));

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.fill();
    }
  }

  // --- Shooting stars ---

  private maybeSpawnShootingStar(): void {
    if (
      this.shootingStars.length < this.SHOOTING_STAR_MAX &&
      Math.random() < this.SHOOTING_STAR_SPAWN_CHANCE
    ) {
      this.shootingStars.push(this.spawnShootingStar());
    }
  }

  private drawAndUpdateShootingStars(): void {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    this.shootingStars = this.shootingStars.filter((s) => {
      // Fade in during first 20% of life, fade out during last 30%
      let alpha: number;
      if (s.life < 0.2) {
        alpha = s.life / 0.2;
      } else if (s.life > 0.7) {
        alpha = 1 - (s.life - 0.7) / 0.3;
      } else {
        alpha = 1;
      }
      alpha = Math.max(0, Math.min(1, alpha)) * 0.9;

      // Head position
      const hx = s.x;
      const hy = s.y;

      // Tail position (opposite direction of velocity, scaled by trail length)
      const mag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const tx = hx - (s.vx / mag) * s.length;
      const ty = hy - (s.vy / mag) * s.length;

      // Draw glowing trail using a radial gradient along the line
      const gradient = ctx.createLinearGradient(tx, ty, hx, hy);
      // Tail: transparent
      gradient.addColorStop(0, `hsla(${200 + s.hue}, 80%, 95%, 0)`);
      // Mid: soft glow
      gradient.addColorStop(0.6, `hsla(${200 + s.hue}, 80%, 95%, ${alpha * 0.4})`);
      // Head: bright white-blue
      gradient.addColorStop(1, `hsla(${200 + s.hue}, 90%, 98%, ${alpha})`);

      ctx.save();

      // Glow effect: draw a wider, blurred-ish line behind the sharp one
      ctx.lineWidth = s.width * 4;
      ctx.strokeStyle = `hsla(${200 + s.hue}, 70%, 85%, ${alpha * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Sharp core line
      ctx.lineWidth = s.width;
      ctx.strokeStyle = gradient;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Bright head dot
      const headGlow = ctx.createRadialGradient(hx, hy, 0, hx, hy, s.width * 3);
      headGlow.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      headGlow.addColorStop(1, `rgba(180, 210, 255, 0)`);
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(hx, hy, s.width * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Advance position and life
      s.x += s.vx;
      s.y += s.vy;
      s.life += s.lifeSpeed;

      // Remove when fully off-screen or life expired
      const offScreen = s.x > W + 50 || s.y > H + 50;
      return s.life < 1 && !offScreen;
    });
  }
}
