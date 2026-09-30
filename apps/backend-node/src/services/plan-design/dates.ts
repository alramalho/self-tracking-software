const DAY = 86_400_000;

export const parseDay = (value: string) => Date.parse(`${value}T12:00:00Z`);
export const formatDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (value: string, days: number) => formatDay(parseDay(value) + days * DAY);
export const daysBetween = (from: string, to: string) => Math.round((parseDay(to) - parseDay(from)) / DAY);

/** Last day of a road that is `weeks` long and starts on `startDate`. */
export const finishingDateFor = (startDate: string, weeks: number) => addDays(startDate, weeks * 7 - 1);
