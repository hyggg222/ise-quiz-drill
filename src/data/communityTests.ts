import type { QuizConfig } from '../types/quiz';
import { applyPresetConfig, presets } from '../utils/presets';
import { parseQuizJson } from '../utils/quizSchema';

// Each file through the importer with the settings of the preset its folder
// names (community/<preset id>/<test id>.json); the file keeps its own title
export function loadCommunity(files: Record<string, unknown>): QuizConfig[] {
  return Object.entries(files)
    .map(([path, data]) => {
      const [, folder, file] = path.match(/([^/]+)\/([^/]+)\.json$/) ?? [];
      const preset = presets.find((p) => p.id === folder);
      if (!preset) throw new Error(`${path}: not in a preset folder`);
      const result = parseQuizJson(JSON.stringify(data), {
        ...applyPresetConfig(preset),
        title: '',
        fallbackId: file,
      });
      if (!result.ok) throw new Error(`${path}: ${result.errors.join(' ')}`);
      return { ...result.quiz, id: file };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

// The tests in src/data/community, read at build time
export const communityTests = loadCommunity(
  import.meta.glob('./community/**/*.json', { eager: true, import: 'default' }),
);
