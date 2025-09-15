import { format } from "date-fns";

export const todaysLocalDate = () => {
  return new Date(format(new Date(), "yyyy-MM-dd") + "T00:00:00.000Z");
};

export const toMidnightUTCDate = (date: Date) => {
  const newDate = new Date(format(date, "yyyy-MM-dd") + "T00:00:00.000Z");
  return newDate;
};
