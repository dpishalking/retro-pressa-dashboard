import assert from "node:assert/strict";
import {
  formatIsoMonthRu,
  parseManagerSchedule,
  parseScheduleTabTitle,
  pickScheduleMonth
} from "../lib/sales/manager-schedule";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

function weekdaysFrom(start: (typeof WEEKDAYS)[number], count: number): string[] {
  const origin = WEEKDAYS.indexOf(start);
  return Array.from({ length: count }, (_, index) => WEEKDAYS[(origin + index) % 7]!);
}

const augustWeekdays = weekdaysFrom("сб", 31);

const misalignedDayRow = ["Менеджер", ...Array.from({ length: 31 }, (_, index) => String(index + 1))];
const weekdayRow = ["", "Норма 15 раб. смен", ...augustWeekdays, "см"];

function shiftCells(workDays: number[]): string[] {
  return Array.from({ length: 31 }, (_, index) => (workDays.includes(index + 1) ? "1" : ""));
}

const kiraDays = [1, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21];
const nadezhdaDays = [1, 2, 8, 9, 15, 16, 22, 23, 29, 30, 31];
const elenaDays = [3, 4, 5, 6, 7, 10, 11, 12, 13, 14];
const anastasiaDays = [1, 4, 5, 6, 11, 12, 13, 18, 19, 20, 25, 26, 27];
const olgaDays = [2, 9, 16, 23, 30];

const augustRows = [
  misalignedDayRow,
  weekdayRow,
  ["1", "Самуйлова Кира", ...shiftCells(kiraDays), "16"],
  ["2", "Надежда", ...shiftCells(nadezhdaDays), "11"],
  ["3", "Елена", ...shiftCells(elenaDays), "10"],
  ["4", "Анастасия", ...shiftCells(anastasiaDays), "13"],
  ["5", "Ольга", ...shiftCells(olgaDays), "5"],
  ["", "людей в смене", ...Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return String(
      [kiraDays, nadezhdaDays, elenaDays, anastasiaDays, olgaDays].filter((days) => days.includes(day)).length
    );
  })],
  ["рабочая смена с 8.00 - 20.00"],
  ["выходной"]
];

const parsed = parseManagerSchedule(augustRows, "2026-08");

assert.equal(parsed.days.length, 31);
assert.equal(parsed.days[0]?.day, 1);
assert.equal(parsed.days[0]?.weekday, "сб");
assert.equal(parsed.days[0]?.date, "2026-08-01");
assert.equal(parsed.days[2]?.weekday, "пн");
assert.equal(parsed.days[30]?.day, 31);
assert.equal(parsed.normShifts, 15);
assert.equal(parsed.shiftHours, "8:00–20:00");
assert.equal(parsed.managers.length, 5);
assert.deepEqual(
  parsed.managers.map((row) => row.name),
  ["Самуйлова Кира", "Надежда", "Елена", "Анастасия", "Ольга"]
);
assert.equal(parsed.managers[0]?.shiftCount, 16);
assert.equal(parsed.managers[0]?.shifts[0], true);
assert.equal(parsed.managers[0]?.shifts[1], false);
assert.equal(parsed.managers[4]?.name, "Ольга");
assert.equal(parsed.managers[4]?.shiftCount, 5);
assert.equal(parsed.coverage[0], 3);
assert.equal(parsed.coverage[1], 2);

const emptyMonth = parseManagerSchedule([["Менеджер"], ["График"]], "2026-09");
assert.equal(emptyMonth.days.length, 0);
assert.equal(emptyMonth.managers.length, 0);

assert.deepEqual(parseScheduleTabTitle("Август26", 2026), { isoMonth: "2026-08", hasYear: true });
assert.deepEqual(parseScheduleTabTitle("Сентябрь 26", 2026), { isoMonth: "2026-09", hasYear: true });
assert.deepEqual(parseScheduleTabTitle("Май", 2026), { isoMonth: "2026-05", hasYear: false });
assert.deepEqual(parseScheduleTabTitle("Июль", 2026), { isoMonth: "2026-07", hasYear: false });
assert.equal(parseScheduleTabTitle("Лист1", 2026), null);
assert.equal(formatIsoMonthRu("2026-08"), "август 2026");

const months = [{ isoMonth: "2026-05" }, { isoMonth: "2026-07" }, { isoMonth: "2026-08" }];
assert.equal(pickScheduleMonth(months, null, "2026-08-13"), "2026-08");
assert.equal(pickScheduleMonth(months, "2026-07", "2026-08-13"), "2026-07");
assert.equal(pickScheduleMonth(months, null, "2026-09-01"), "2026-08");

const alignedHeader = [
  ["", "", ...Array.from({ length: 31 }, (_, index) => String(index + 1))],
  ["", "Норма 15 раб. смен", ...augustWeekdays],
  ["1", "Кира", ...shiftCells([1, 2, 3])]
];
const aligned = parseManagerSchedule(alignedHeader, "2026-08");
assert.equal(aligned.days[0]?.day, 1);
assert.equal(aligned.managers[0]?.shifts[0], true);
assert.equal(aligned.managers[0]?.shifts[2], true);
assert.equal(aligned.managers[0]?.shifts[3], false);

console.log("manager-schedule.test.ts: ok");
