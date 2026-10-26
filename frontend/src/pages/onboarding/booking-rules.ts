/**
 * Booking rule choices shared by meeting types and group meetings.
 */

/** Choices in seconds, like the Duration fields store them. */
export const LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120].map((m) => m * 60);
export const BREAKS = [0, 5, 10, 15, 20, 30, 45, 60].map((m) => m * 60);

export const WHOLE_NUMBER = /^\d+$/;

export const daysLabel = (n: number) => (n === 1 ? "1 day" : `${n} days`);
