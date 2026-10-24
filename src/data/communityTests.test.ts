import { describe, it, expect } from 'vitest';
import { communityTests, loadCommunity } from './communityTests';
import { applyPresetConfig, presets } from '../utils/presets';
import { sampleQuiz } from './sampleQuiz';

const files = import.meta.glob('./community/**/*.json');
const itg = applyPresetConfig(presets.find((p) => p.id === 'itg')!);

describe('community tests', () => {
  it('loads every file in the community folders through the importer', () => {
    expect(communityTests.length).toBeGreaterThan(0);
    expect(communityTests).toHaveLength(Object.keys(files).length);
  });

  it('takes the id from the file name, so two files never share one', () => {
    const ids = communityTests.map((test) => test.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('lists the tests by title', () => {
    const titles = communityTests.map((test) => test.title);

    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it('applies the settings of the preset its folder names, keeping its title', () => {
    const [test] = loadCommunity({
      './community/itg/my-test.json': { ...sampleQuiz, id: 'quiz-123' },
    });

    expect(test.id).toBe('my-test');
    expect(test.title).toBe(sampleQuiz.title);
    expect(test.timeLimitMinutes).toBe(itg.timeLimitMinutes);
    expect(test.templateMode).toBe('single-page');
    expect(test.antiCheat).toEqual(itg.antiCheat);
  });

  it('refuses a file outside a preset folder, or in an unknown one', () => {
    expect(() =>
      loadCommunity({ './community/loose.json': sampleQuiz }),
    ).toThrow(/loose\.json/);
    expect(() =>
      loadCommunity({ './community/nope/a.json': sampleQuiz }),
    ).toThrow(/nope/);
  });

  it('names the file that the importer refuses', () => {
    expect(() =>
      loadCommunity({
        './community/itg/broken.json': { title: 'No questions' },
      }),
    ).toThrow(/broken\.json/);
  });
});
