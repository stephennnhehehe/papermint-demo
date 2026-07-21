import type { Vehicle, VehicleTrip } from "./types";

export function tripKilometres(trip: Pick<VehicleTrip, "start_odometer" | "end_odometer">) {
  return Math.max(0, Math.round((Number(trip.end_odometer) - Number(trip.start_odometer)) * 10) / 10);
}

export function logbookPeriodDays(vehicle: Pick<Vehicle, "logbook_start_date" | "logbook_end_date">) {
  if (!vehicle.logbook_start_date || !vehicle.logbook_end_date) return 0;
  const start = new Date(`${vehicle.logbook_start_date}T00:00:00Z`).getTime();
  const end = new Date(`${vehicle.logbook_end_date}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function vehicleLogbookSummary(vehicle: Vehicle, trips: VehicleTrip[]) {
  const vehicleTrips = trips.filter((trip) => trip.vehicle_id === vehicle.id);
  const totalKilometres = vehicleTrips.reduce((sum, trip) => sum + tripKilometres(trip), 0);
  const businessKilometres = vehicleTrips
    .filter((trip) => trip.is_business)
    .reduce((sum, trip) => sum + tripKilometres(trip), 0);
  const periodDays = logbookPeriodDays(vehicle);
  return {
    tripCount: vehicleTrips.length,
    totalKilometres: Math.round(totalKilometres * 10) / 10,
    businessKilometres: Math.round(businessKilometres * 10) / 10,
    businessUsePercent: totalKilometres > 0 ? Math.round((businessKilometres / totalKilometres) * 10_000) / 100 : 0,
    periodDays,
    hasRepresentativePeriod: periodDays >= 84,
    hasOdometerPeriod: vehicle.opening_odometer !== null && vehicle.closing_odometer !== null
  };
}
