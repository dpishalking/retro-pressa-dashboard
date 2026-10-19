import assert from "node:assert/strict";
import {
  birthdayColumnsForDeals,
  celebrantBirthdayLabel,
  celebrantBirthdaysFromDeal,
  daysUntilCelebrantBirthday,
  parseCelebrantBirthdays
} from "@/lib/rop-alerts/celebrant-birthday";

const today = new Date("2026-10-19T12:00:00+03:00");

function labels(value: string, compact = false) {
  return parseCelebrantBirthdays(value, { allowCompact: compact }).map(celebrantBirthdayLabel);
}

assert.deepEqual(labels("28.11.1976"), ["28.11.1976"]);
assert.deepEqual(labels("040969", true), ["04.09.1969"]);
assert.deepEqual(labels("21:09:1970"), ["21.09.1970"]);
assert.deepEqual(labels("09 10.1953"), ["09.10.1953"]);
assert.deepEqual(labels("15.10.1971."), ["15.10.1971"]);
assert.deepEqual(labels("01/10/1980"), ["01.10.1980"]);
assert.deepEqual(labels("16 ноября 1968"), ["16.11.1968"]);
assert.deepEqual(labels("Правда, № 315, 11 ноября 1966г."), ["11.11.1966"]);
assert.deepEqual(labels("Крокодил, № 1, Январь 1977г."), ["01.1977"]);
assert.deepEqual(labels("100858 Маргарита (журнал персон)"), []);
assert.deepEqual(labels("За рулём - 10.1993"), ["10.1993"]);
assert.deepEqual(labels("08.02.1981 / 11.02.1977"), ["08.02.1981", "11.02.1977"]);
assert.deepEqual(labels("02.01 02.01.84"), ["02.01.1984"]);
assert.deepEqual(labels("Крокодил 24.04.1962, Крокодил 2.02. 1964"), ["24.04.1962", "02.02.1964"]);
assert.deepEqual(labels(""), []);

const fromTitle = celebrantBirthdaysFromDeal({
  birthText: "",
  title: "Анна Залипская- оригинал Комсомольская правда 26.10.1990",
  newspaper: ""
});
assert.deepEqual(fromTitle.map(celebrantBirthdayLabel), ["26.10.1990"]);

const fieldWins = celebrantBirthdaysFromDeal({
  birthText: "05.10.1995",
  title: "газета 01.01.2000",
  newspaper: "10.1993"
});
assert.deepEqual(fieldWins.map(celebrantBirthdayLabel), ["05.10.1995"]);

assert.equal(daysUntilCelebrantBirthday(parseCelebrantBirthdays("24.10.1973")[0], today), 5);
assert.equal(daysUntilCelebrantBirthday(parseCelebrantBirthdays("19.10.1970")[0], today), 0);
assert.equal(daysUntilCelebrantBirthday(parseCelebrantBirthdays("05.10.1995")[0], today), -14);
assert.equal(daysUntilCelebrantBirthday(parseCelebrantBirthdays("12.09.1961")[0], today), 328);

const columns = birthdayColumnsForDeals(
  [
    parseCelebrantBirthdays("24.10.1973"),
    parseCelebrantBirthdays("05.10.1995"),
    [],
    parseCelebrantBirthdays("19.10.1970")
  ],
  today
);
assert.deepEqual(
  columns.map((row) => row.queue),
  [3, 1, 4, 2]
);
assert.equal(columns[1].when, "14 дн. назад");
assert.equal(columns[2].when, "нет даты");
assert.equal(columns[3].when, "сегодня");
