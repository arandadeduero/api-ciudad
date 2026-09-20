export interface BusLine {
  id: string;
  shortName: string;
  longName: string;
  color: string | null;
}

export interface BusStop {
  id: string;
  name: string;
  location: { latitude: number; longitude: number };
  wheelchairAccessible: boolean | null;
}

export interface NearestStopResult {
  stop: BusStop;
  distanceMeters: number;
  lines: Pick<BusLine, 'id' | 'shortName'>[];
}

export interface NextBusEntry {
  line: string;
  destination: string;
  scheduledTime: string; // HH:MM
  minutesUntil: number;
}

export interface StopNextBuses {
  stop: BusStop;
  nextBuses: NextBusEntry[];
}
