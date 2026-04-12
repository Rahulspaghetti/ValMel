import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  icon: string;
  feelsLike: number;
}

export type WeatherError = 'location' | 'api';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);

  getWeather(): Observable<WeatherData> {
    return from(this.getPosition()).pipe(
      catchError(() => throwError(() => ({ type: 'location' as WeatherError }))),
      switchMap(({ lat, lon }) =>
        this.http.get<any>(
          `https://api.openweathermap.org/data/2.5/weather` +
          `?lat=${lat}&lon=${lon}&appid=${environment.openWeatherMapApiKey}&units=metric`
        ).pipe(
          catchError(() => throwError(() => ({ type: 'api' as WeatherError })))
        )
      ),
      map((res) => ({
        city: res.name,
        temperature: Math.round(res.main.temp),
        description: res.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${res.weather[0].icon}@2x.png`,
        feelsLike: Math.round(res.main.feels_like)
      }))
    );
  }

  private getPosition(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => reject(err)
      );
    });
  }
}
