export type SolarMoment = {
  label: string;
  season: "spring_autumn_equinox" | "summer_solstice" | "winter_solstice";
  localDate: string;
  localTime: string;
  solarAzimuthDegrees: number;
  solarElevationDegrees: number;
  shadowBearingDegrees: number;
  shadowDirection: string;
  isAboveHorizon: boolean;
};

export type SolarAnalysisResult = {
  source: { provider: string; basis: string; sourceUrl: string; timeZone: string; calculatedAt: string };
  location: { latitude: number; longitude: number };
  moments: SolarMoment[];
  limitations: string[];
};
