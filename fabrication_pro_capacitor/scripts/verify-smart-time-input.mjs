import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(path.join(root,'www','app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'www','index.html'),'utf8');

function expect(condition,message) {
  if (!condition) throw new Error(message);
}

function loadSmartTimeCore() {
  const start='// @shift-smart-time-start';
  const end='// @shift-smart-time-end';
  const from=app.indexOf(start);
  const to=app.indexOf(end);
  expect(from>=0 && to>from,'Smart Shift time parser markers are missing from app.js.');
  const block=app.slice(from+start.length,to);
  return new Function(`${block}\nreturn {normalizeShiftTimeEntry,shiftTimeTo24};`)();
}

const core=loadSmartTimeCore();

const cases=[
  ['7','7:00'],
  ['12','12:00'],
  ['130','1:30'],
  ['730','7:30'],
  ['0730','7:30'],
  ['1230','12:30'],
  ['7:30','7:30'],
  ['12:05','12:05'],
  [' 730 ','7:30']
];
for (const [input,expected] of cases) {
  expect(core.normalizeShiftTimeEntry(input)===expected,`${JSON.stringify(input)} must normalize to ${expected}.`);
}

for (const input of ['', '0', '00', '30', '1260', '1375', '1300', '9999', '7:5', 'abc']) {
  expect(core.normalizeShiftTimeEntry(input)===null,`${JSON.stringify(input)} must remain invalid.`);
}

expect(core.shiftTimeTo24('730','AM')==='07:30','730 AM must save as 07:30.');
expect(core.shiftTimeTo24('730','PM')==='19:30','730 PM must save as 19:30.');
expect(core.shiftTimeTo24('12','AM')==='00:00','12 AM must save as midnight.');
expect(core.shiftTimeTo24('12','PM')==='12:00','12 PM must save as noon.');
expect(core.shiftTimeTo24('1230','AM')==='00:30','1230 AM must save as 00:30.');
expect(core.shiftTimeTo24('7:30','PM')==='19:30','Existing colon-formatted input must remain supported.');
expect(core.shiftTimeTo24('1375','AM')===null,'Impossible time must be rejected.');
expect(core.shiftTimeTo24('730','XX')===null,'Invalid AM/PM value must be rejected.');

for (const id of ['shiftClockInTime','shiftBreakTime','shiftLunchTime','shiftClockOutTime']) {
  expect(app.includes(`bindShiftSmartTimeInput(${id})`),`${id} must use smart phone time normalization.`);
}
expect(html.includes('No colon needed.'),'Settings must tell phone users that no colon is needed.');

console.log('Smart Shift time entry behavior: OK');
