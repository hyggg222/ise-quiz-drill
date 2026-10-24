import React from 'react';
import { Users } from 'lucide-react';
import type { QuizConfig } from '../../types/quiz';
import { communityTests } from '../../data/communityTests';
import { EmptyState } from '../library/EmptyState';
import { QuizCard, cardGrid } from '../library/QuizCard';

export interface CommunityLibraryProps {
  onStart: (quiz: QuizConfig) => void;
  tests?: QuizConfig[];
}

// The Community Library page: the tests shipped in src/data/community
export const CommunityLibrary: React.FC<CommunityLibraryProps> = ({
  onStart,
  tests = communityTests,
}) => (
  <section
    aria-labelledby="community-library-title"
    className="w-full max-w-[1150px] mx-auto p-6 space-y-8 font-sans animate-fade-in"
  >
    <div className="border-b border-gray-200 pb-5">
      <h1
        id="community-library-title"
        className="text-3xl font-bold text-gray-900 tracking-tight"
      >
        Community Library
      </h1>
      <p className="text-gray-600 text-sm mt-1">
        Tests shared with every visitor. Start one at once; it is also saved to
        your Saved Library.
      </p>
    </div>
    {tests.length === 0 ? (
      <EmptyState
        icon={<Users aria-hidden="true" className="w-8 h-8" />}
        title="No tests published yet"
        text="When a test is added to the library, it shows up here for everyone."
      />
    ) : (
      <div className={cardGrid}>
        {tests.map((test) => (
          <QuizCard
            key={test.id}
            quiz={test}
            onStart={() => onStart({ ...test, id: `community-${test.id}` })}
          />
        ))}
      </div>
    )}
  </section>
);
