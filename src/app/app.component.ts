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
  greetingText = signal('');
  greetingEmoji = signal('');

  private midnightTimer: ReturnType<typeof setTimeout> | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private audio: HTMLAudioElement | null = null;

  dismissIntro(): void {
    this.showIntro.set(false);
    if (!this.audio) return;
    this.audio.play().then(() => this.musicPlaying.set(true)).catch(() => {});
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

  private setGreeting(): void {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12)  { this.greetingText.set('Good Morning');            this.greetingEmoji.set('☀️'); }
    else if (hour >= 12 && hour < 17) { this.greetingText.set('Good Afternoon');     this.greetingEmoji.set('🌸'); }
    else if (hour >= 17 && hour < 21) { this.greetingText.set('Good Evening');       this.greetingEmoji.set('🌅'); }
    else                              { this.greetingText.set('Goodnight mi chula reina'); this.greetingEmoji.set('🌙'); }
  }

  ngOnInit(): void {
    this.setGreeting();
    this.audio = new Audio('assets/music.mp3');
    this.audio.loop = true;
    this.audio.volume = 0.5;
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
