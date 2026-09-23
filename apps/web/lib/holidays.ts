import type { HolidayTable } from '@wordle-duel/core';
import holidayDaysJson from '@/data/holiday-days.json';

/**
 * The shared holiday calendar (More Games §20), bundled as data on every
 * platform: apps/web/data/holiday-days.json. Games ask their bank for the day's
 * puzzle with this table; the header shows the holiday's name so the player
 * knows why today's puzzle is themed.
 */
export const HOLIDAY_TABLE = holidayDaysJson as HolidayTable;

export const HOLIDAY_TITLES: Record<string, string> = {
  newyear: 'New Year', mlkday: 'MLK Day', groundhog: 'Groundhog Day', valentines: "Valentine's Day", presidents: "Presidents' Day",
  leapday: 'Leap Day', mardigras: 'Mardi Gras', stpatricks: "St Patrick's Day", aprilfools: 'April Fools', easter: 'Easter',
  earthday: 'Earth Day', cincodemayo: 'Cinco de Mayo', mothersday: "Mother's Day", memorial: 'Memorial Day', fathersday: "Father's Day",
  juneteenth: 'Juneteenth', july4: 'Fourth of July', labor: 'Labor Day', indigenous: 'Harvest Moon', halloween: 'Halloween',
  veterans: 'Veterans Day', thanksgiving: 'Thanksgiving', christmas: 'Christmas', kwanzaa: 'Kwanzaa', lunarnewyear: 'Lunar New Year',
  passover: 'Passover', diwali: 'Diwali', hanukkah: 'Hanukkah',
};

export function holidayTitle(key: string | null | undefined): string | null {
  return key ? HOLIDAY_TITLES[key] ?? null : null;
}
