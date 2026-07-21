import { describe, expect, it } from "vitest";
import type { Vehicle, VehicleTrip } from "./types";
import { logbookPeriodDays, tripKilometres, vehicleLogbookSummary } from "./vehicle-logbook";

const vehicle = {
  id: "vehicle",
  logbook_start_date: "2026-07-01",
  logbook_end_date: "2026-09-22",
  opening_odometer: 1000,
  closing_odometer: 2000
} as Vehicle;

describe("vehicle logbook calculations", () => {
  it("calculates trip kilometres without allowing negative distances", () => {
    expect(tripKilometres({ start_odometer: 100, end_odometer: 125.4 })).toBe(25.4);
    expect(tripKilometres({ start_odometer: 125, end_odometer: 100 })).toBe(0);
  });

  it("recognises a continuous 12-week period", () => {
    expect(logbookPeriodDays(vehicle)).toBe(84);
  });

  it("calculates business use from all recorded travel", () => {
    const trips = [
      { vehicle_id: "vehicle", start_odometer: 1000, end_odometer: 1100, is_business: true },
      { vehicle_id: "vehicle", start_odometer: 1100, end_odometer: 1150, is_business: false }
    ] as VehicleTrip[];
    expect(vehicleLogbookSummary(vehicle, trips)).toMatchObject({
      tripCount: 2,
      totalKilometres: 150,
      businessKilometres: 100,
      businessUsePercent: 66.67,
      periodDays: 84,
      hasRepresentativePeriod: true,
      hasOdometerPeriod: true
    });
  });
});
