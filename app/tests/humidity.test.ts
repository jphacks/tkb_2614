import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  absoluteHumidity, dewPoint, relativeHumidityAt, saturationVaporPressureHpa, vaporPressureHpa,
} from '../src/domain/humidity';

const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

test('飽和水蒸気圧と水蒸気圧は Magnus 式の値になる', () => {
  assert.equal(round1(saturationVaporPressureHpa(0)), 6.1);
  assert.equal(round1(saturationVaporPressureHpa(20)), 23.3);
  assert.equal(round1(vaporPressureHpa(20, 50)), 11.7);
  assert.equal(vaporPressureHpa(20, 0), 0);
});

test('絶対湿度は代表値と一致する', () => {
  assert.equal(round1(absoluteHumidity(10, 80)), 7.5);
  assert.equal(round1(absoluteHumidity(22, 60)), 11.6);
});

test('露点は代表値と一致し、その温度で飽和する', () => {
  assert.equal(round1(dewPoint(20, 50)), 9.3);
  assert.equal(round1(dewPoint(20, 60)), 12.0);
  assert.ok(Math.abs(dewPoint(15, 100)! - 15) < 1e-9);
  const dew = dewPoint(25, 70)!;
  assert.ok(Math.abs(saturationVaporPressureHpa(dew) - vaporPressureHpa(25, 70)!) < 1e-9);
});

test('温めると相対湿度が下がり、冷やして飽和したら 100% で頭打ちになる', () => {
  // 10℃・80% の外気を 22℃ に温めても水蒸気圧は同じで、絶対湿度は下がる。
  assert.equal(round1(relativeHumidityAt(22, 10, 80)), 37.2);
  assert.equal(round1(absoluteHumidity(22, relativeHumidityAt(22, 10, 80))), 7.2);
  assert.ok(Math.abs(relativeHumidityAt(20, 20, 55)! - 55) < 1e-9);
  assert.equal(relativeHumidityAt(5, 20, 60), 100);
});

test('欠測・非有限・範囲外の入力では null を返す', () => {
  assert.equal(vaporPressureHpa(null, 50), null);
  assert.equal(vaporPressureHpa(20, null), null);
  assert.equal(vaporPressureHpa(Number.NaN, 50), null);
  assert.equal(vaporPressureHpa(20, 101), null);
  assert.equal(vaporPressureHpa(20, -1), null);
  assert.equal(vaporPressureHpa(-41, 50), null);
  assert.equal(vaporPressureHpa(61, 50), null);
  assert.equal(dewPoint(20, 0), null);
  assert.equal(dewPoint(null, 50), null);
  assert.equal(absoluteHumidity(20, null), null);
  assert.equal(relativeHumidityAt(null, 10, 80), null);
  assert.equal(relativeHumidityAt(22, 10, null), null);
});
