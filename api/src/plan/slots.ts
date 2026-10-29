import { wallClockAsUtc, type Interval } from "@circles/shared";

const slotMs = 2 * 60 * 60 * 1000;
const stepMs = 30 * 60 * 1000;
const firstStartHour = 8;
const lastStartHour = 21;

export function slotsIn(freeWindows: Interval[], timezone: string): Interval[] {
  const slots: Interval[] = [];
  for (const window of freeWindows) {
    const end = Date.parse(window.end);
    let start = Math.ceil(Date.parse(window.start) / stepMs) * stepMs;
    for (; start + slotMs <= end; start += stepMs) {
      const local = new Date(wallClockAsUtc(new Date(start), timezone));
      const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
      if (hour < firstStartHour || hour > lastStartHour) continue;
      slots.push({
        start: new Date(start).toISOString(),
        end: new Date(start + slotMs).toISOString(),
      });
    }
  }
  return slots;
}
