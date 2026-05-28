import { describe, expect, it } from "vitest";
import { computeSeatUsage } from "../src/seat-accounting-service.js";

describe("computeSeatUsage", () => {
  it("counts active members and pending invitations as used seats", () => {
    const summary = computeSeatUsage({
      activeMembers: 3,
      pendingInvitations: 2,
      includedSeats: 5,
      extraSeats: 1
    });

    expect(summary).toEqual({
      activeMembers: 3,
      pendingInvitations: 2,
      usedSeats: 5,
      includedSeats: 5,
      extraSeats: 1,
      totalSeats: 6,
      seatsRemaining: 1,
      overLimit: false
    });
  });

  it("flags over-limit usage when seats exceed included plus extra", () => {
    const summary = computeSeatUsage({
      activeMembers: 4,
      pendingInvitations: 3,
      includedSeats: 5,
      extraSeats: 1
    });

    expect(summary.usedSeats).toBe(7);
    expect(summary.totalSeats).toBe(6);
    expect(summary.seatsRemaining).toBe(0);
    expect(summary.overLimit).toBe(true);
  });

  it("treats zero allowance as fully over limit when seats are in use", () => {
    const summary = computeSeatUsage({
      activeMembers: 1,
      pendingInvitations: 0,
      includedSeats: 0,
      extraSeats: 0
    });

    expect(summary.totalSeats).toBe(0);
    expect(summary.seatsRemaining).toBe(0);
    expect(summary.overLimit).toBe(true);
  });

  it("reports remaining seats when usage is below allowance", () => {
    const summary = computeSeatUsage({
      activeMembers: 2,
      pendingInvitations: 1,
      includedSeats: 10,
      extraSeats: 0
    });

    expect(summary.usedSeats).toBe(3);
    expect(summary.seatsRemaining).toBe(7);
    expect(summary.overLimit).toBe(false);
  });
});
