import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { BibleService, BibleVerse } from './services/bible.service';
import { WeatherService, WeatherData, WeatherError } from './services/weather.service';
import { CuteMessageService } from './services/cute-message.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private bibleService = inject(BibleService);
  private weatherService = inject(WeatherService);
  private cuteMessageService = inject(CuteMessageService);

  bibleVerse = signal<BibleVerse | null>(null);
  bibleLoading = signal(true);
  bibleError = signal(false);

  weather = signal<WeatherData | null>(null);
  weatherLoading = signal(true);
  weatherError = signal<WeatherError | null>(null);

  cuteMessage = signal('');

  showIntro = signal(true);
  musicPlaying = signal(false);

  private midnightTimer: ReturnType<typeof setTimeout> | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private audio: HTMLAudioElement | null = null;

  dismissIntro(): void {
    this.showIntro.set(false);
    this.audio = new Audio('assets/music.mp3');
    this.audio.loop = true;
    this.audio.volume = 0.5;
    this.musicTimer = setTimeout(() => {
      this.audio!.play().then(() => this.musicPlaying.set(true)).catch(() => {});
    }, 5000);
  }

  toggleMusic(): void {
    if (!this.audio) return;
    if (this.musicPlaying()) {
      this.audio.pause();
      this.musicPlaying.set(false);
    } else {
      this.audio.play().then(() => this.musicPlaying.set(true)).catch(() => {});
    }
  }

  ngOnInit(): void {
    this.cuteMessage.set(this.cuteMessageService.getMessage());
    this.scheduleMidnightRefresh();
    this.loadBibleVerse();
    this.loadWeather();
  }

  ngOnDestroy(): void {
    if (this.midnightTimer !== null) clearTimeout(this.midnightTimer);
    if (this.musicTimer !== null) clearTimeout(this.musicTimer);
    this.audio?.pause();
  }

  private scheduleMidnightRefresh(): void {
    this.midnightTimer = setTimeout(() => {
      this.cuteMessage.set(this.cuteMessageService.getMessage());
      this.loadBibleVerse();
      this.scheduleMidnightRefresh();
    }, this.cuteMessageService.msUntilMidnight());
  }

  loadBibleVerse(): void {
    this.bibleLoading.set(true);
    this.bibleError.set(false);
    this.bibleService.getDailyVerse().subscribe({
      next: (verse) => {
        this.bibleVerse.set(verse);
        this.bibleLoading.set(false);
      },
      error: () => {
        this.bibleError.set(true);
        this.bibleLoading.set(false);
      }
    });
  }

  loadWeather(): void {
    this.weatherLoading.set(true);
    this.weatherError.set(null);
    this.weatherService.getWeather().subscribe({
      next: (data) => {
        this.weather.set(data);
        this.weatherLoading.set(false);
      },
      error: (err: { type: WeatherError }) => {
        this.weatherError.set(err?.type ?? 'api');
        this.weatherLoading.set(false);
      }
    });
  }

}
