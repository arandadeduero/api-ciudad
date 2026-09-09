export interface OraDistrict {
  id: string;
  streets: string[];
  note: string | null;
}

export interface OraSchedule {
  mondayToFriday: { from: string; to: string }[];
  saturday: { from: string; to: string }[];
  sunday: { from: string; to: string }[];
  exception: {
    location: string;
    mondayToSaturday: { from: string; to: string }[];
  };
}

export interface OraDuration {
  residents: string;
  nonResidentsDefault: { zone: string; maxMinutes: number };
  greenZone: { maxMinutes: number; streets: string[] };
}

export interface OraInfo {
  schedule: OraSchedule;
  exemptPeriods: { description: string; dynamic?: boolean | undefined }[];
  duration: OraDuration;
  exemptVehicles: string[];
  districts: OraDistrict[];
}

export interface PublicParking {
  id: string;
  name: string;
  type: 'public';
  address: string;
  postalCode: string;
  city: string;
  location: { latitude: number; longitude: number };
  hours: string;
  capacity: number | null;
  availableSpaces: number | null;
  availabilityStatus: 'NOT_AVAILABLE';
  phone: string | null;
}
