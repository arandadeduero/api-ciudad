export interface PollutantReading {
  code: string;
  label: string;
  unit: string;
  value: number;
}

export interface HourlyAirQuality {
  hour: string;
  pollutants: PollutantReading[];
}

export interface StationInfo {
  id: number;
  name: string;
  province: string;
  location: { latitude: number; longitude: number };
}

export interface AirQualitySnapshot {
  station: StationInfo;
  date: string;
  /** 'hourly' = dataset del día en curso; 'daily' = agregado histórico validado (menor resolución, con retraso de publicación). */
  granularity: 'hourly' | 'daily';
  hourly: HourlyAirQuality[];
  daily: PollutantReading[] | null;
  source: string;
}
