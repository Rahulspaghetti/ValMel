export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  icon: string;
  feelsLike: number;
}

export type WeatherError = 'location' | 'api';

function getPosition(): Promise<{ lat: number; lon: number }> {
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

export async function getWeather(): Promise<WeatherData> {
  let lat: number, lon: number;

  try {
    ({ lat, lon } = await getPosition());
  } catch {
    throw { type: 'location' as WeatherError };
  }

  const apiKey = process.env.NEXT_PUBLIC_WEATHERMAP_API_KEY;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    );
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return {
      city: data.name,
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
      feelsLike: Math.round(data.main.feels_like),
    };
  } catch {
    throw { type: 'api' as WeatherError };
  }
}
