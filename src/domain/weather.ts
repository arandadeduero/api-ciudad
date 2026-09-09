export interface CurrentWeather {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  cloudCover: number;
  pressure: number;
  uvIndex: number;
}

export interface HourlyForecastPoint {
  time: string;
  temperature: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
}

export interface DailySummary {
  date: string;
  sunrise: string;
  sunset: string;
}

export interface WeatherSnapshot {
  current: CurrentWeather;
  hourly: HourlyForecastPoint[];
  daily: DailySummary[];
}
