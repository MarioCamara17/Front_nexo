export interface StationSource { label: string; url: string; }
export interface TrainStation {
  slug: string; name: string; municipality: string; order: number;
  latitude: number; longitude: number; summary: string; history: string;
  opening_hours: string; timetable_url: string; booking_url: string;
  coordinates_source: string; sources: StationSource[]; checked_on: string;
  checkin_radius_m: number; max_accuracy_m: number; checkin_enabled: boolean;
  points: number; visited: boolean; visited_at: string | null;
}
export interface StationCheckin {
  created: boolean; points_awarded: number; visited: boolean;
  visited_at: string; message: string;
}
