import { describe, it, expect } from 'vitest';
import {
  applyPresetConfig,
  applyPresetPrompt,
  describePresetConfig,
  describePresetPrompt,
  presets,
  resetPromptOptions,
  resetTestConfig,
  type Preset,
} from './presets';
import {
  defaultPromptOptions,
  defaultTestConfig,
  easyToHardText,
  validatePromptOptions,
  validateTestConfig,
} from './promptBuilder';

// A preset that sets every field, so the tests do not depend on the real data
const full: Preset = {
  id: 'full',
  name: 'Full',
  prompt: {
    questionCount: 25,
    difficulty: 'custom',
    mix: { easy: 10, medium: 60, hard: 30 },
    types: ['multi-select', 'true-false'],
    topics: 'Topic A',
    notes: 'Some notes',
  },
  config: {
    title: 'Full - Test .',
    timeLimitMinutes: 45,
    templateMode: 'single-page',
    antiCheat: {
      enabled: true,
      tabLock: false,
      uiRestrictions: true,
      fullscreenLock: false,
    },
  },
};

// A preset that leaves every field at the app default
const empty: Preset = {
  id: 'empty',
  name: 'Empty',
  prompt: {
    questionCount: null,
    difficulty: null,
    mix: null,
    types: null,
    topics: null,
    notes: null,
  },
  config: {
    title: null,
    timeLimitMinutes: null,
    templateMode: null,
    antiCheat: {
      enabled: null,
      tabLock: null,
      uiRestrictions: null,
      fullscreenLock: null,
    },
  },
};

describe('applyPresetPrompt', () => {
  it('fills every prompt option from the preset', () => {
    expect(applyPresetPrompt(full)).toEqual(full.prompt);
  });

  it('keeps the app default for a field the preset leaves null', () => {
    expect(applyPresetPrompt(empty)).toEqual(defaultPromptOptions);
  });

  it('keeps the default mix when the preset has none', () => {
    const result = applyPresetPrompt({
      ...full,
      prompt: { ...full.prompt, difficulty: 'hard', mix: null },
    });
    expect(result.difficulty).toBe('hard');
    expect(result.mix).toEqual(defaultPromptOptions.mix);
  });

  it('returns copies, so editing the result cannot change the preset', () => {
    const result = applyPresetPrompt(full);
    result.types.push('mcq');
    result.mix.easy = 99;
    expect(full.prompt.types).toEqual(['multi-select', 'true-false']);
    expect(full.prompt.mix).toEqual({ easy: 10, medium: 60, hard: 30 });
  });
});

describe('applyPresetConfig', () => {
  it('fills every test setting from the preset', () => {
    expect(applyPresetConfig(full)).toEqual(full.config);
  });

  it('keeps the app default for a field the preset leaves null', () => {
    expect(applyPresetConfig(empty)).toEqual(defaultTestConfig);
  });

  it('fills the anti-cheat switches one by one', () => {
    const result = applyPresetConfig({
      ...empty,
      config: {
        ...empty.config,
        antiCheat: { ...empty.config.antiCheat, enabled: true },
      },
    });
    expect(result.antiCheat).toEqual({
      ...defaultTestConfig.antiCheat,
      enabled: true,
    });
  });

  it('returns copies, so editing the result cannot change the preset', () => {
    const result = applyPresetConfig(full);
    result.antiCheat.tabLock = true;
    expect(full.config.antiCheat.tabLock).toBe(false);
  });
});

describe('describePresetPrompt', () => {
  it('names the preset and sums up what it sets for the prompt', () => {
    expect(describePresetPrompt(full)).toBe(
      'Full: 25 questions, multi-select and true-false, difficulty custom.',
    );
  });

  it('uses the app default for a field the preset leaves null', () => {
    expect(describePresetPrompt(empty)).toContain(
      `${defaultPromptOptions.questionCount} questions`,
    );
  });
});

describe('describePresetConfig', () => {
  it('names the preset and sums up what it sets for the test', () => {
    expect(describePresetConfig(full)).toBe(
      'Full: 45 min, single page, anti-cheat on.',
    );
  });

  it('says paginated and anti-cheat off when the preset leaves them to the default', () => {
    expect(describePresetConfig(empty)).toBe(
      `Empty: ${defaultTestConfig.timeLimitMinutes} min, paginated, anti-cheat off.`,
    );
  });
});

describe('reset', () => {
  it('returns the app defaults for the prompt options', () => {
    expect(resetPromptOptions()).toEqual(defaultPromptOptions);
  });

  it('returns the app defaults for the test settings', () => {
    expect(resetTestConfig()).toEqual(defaultTestConfig);
  });

  it('returns fresh objects, so the defaults stay untouched', () => {
    const options = resetPromptOptions();
    options.types.push('multi-blank');
    options.mix.easy = 99;
    const config = resetTestConfig();
    config.antiCheat.enabled = true;
    expect(defaultPromptOptions.types).not.toContain('multi-blank');
    expect(defaultPromptOptions.mix.easy).toBe(30);
    expect(defaultTestConfig.antiCheat.enabled).toBe(false);
  });
});

describe('built-in presets', () => {
  it('has at least one preset with a unique id and a name', () => {
    const ids = presets.map((preset) => preset.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of presets) {
      expect(preset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(preset.name.trim()).not.toBe('');
    }
  });

  it.each(presets.map((preset) => [preset.id, preset] as const))(
    '%s gives prompt options the form accepts',
    (_id, preset) => {
      expect(validatePromptOptions(applyPresetPrompt(preset))).toEqual([]);
    },
  );

  it('asks the ITG preset for 10 questions in 30 minutes: 40% easy, 40% medium, 20% hard', () => {
    const itg = presets.find((p) => p.id === 'itg')!;
    const prompt = applyPresetPrompt(itg);

    expect(prompt.questionCount).toBe(10);
    expect(prompt.difficulty).toBe('custom');
    expect(prompt.mix).toEqual({ easy: 40, medium: 40, hard: 20 });
    expect(applyPresetConfig(itg).timeLimitMinutes).toBe(30);
  });

  it('asks for easy to hard in the ITG notes and leaves DevOps without it', () => {
    const notesOf = (id: string) =>
      applyPresetPrompt(presets.find((preset) => preset.id === id)!).notes;
    expect(notesOf('itg')).toContain(easyToHardText);
    expect(notesOf('devops')).not.toContain(easyToHardText);
  });

  it.each(presets.map((preset) => [preset.id, preset] as const))(
    '%s gives test settings the form accepts',
    (_id, preset) => {
      // The title may be left for the user, so check the rest with a title
      const config = { ...applyPresetConfig(preset), title: 'Title' };
      expect(validateTestConfig(config)).toBeNull();
    },
  );
});
