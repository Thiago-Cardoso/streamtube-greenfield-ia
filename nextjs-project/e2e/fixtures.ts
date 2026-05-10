import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface TestState {
  confirmedUser: { email: string; password: string };
  resetToken: string;
}

export const test = base.extend<{ testData: TestState }>({
  testData: async ({}, use) => {
    const stateFile = path.join(__dirname, 'test-state.json');
    const state: TestState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    await use(state);
  },
});

export { expect } from '@playwright/test';
