import assert from 'node:assert/strict';

import {
  convertTemperature,
  counterpartUnit,
} from '../src/features/observations/temperature-presentation.ts';

assert.equal(convertTemperature(20, 'C', 'F'), 68);
assert.equal(convertTemperature(68, 'F', 'C'), 20);
assert.equal(convertTemperature(-40, 'C', 'F'), -40);
assert.equal(counterpartUnit('C'), 'F');
assert.equal(counterpartUnit('F'), 'C');

console.log('Temperature presentation guard passed.');
