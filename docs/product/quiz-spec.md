# Interface Specification

## 1. Overview & Template Modes

Brightspace Quiz Simulator supports 2 presentation templates:

### Template A: Paginated mode (MVP)

- Behavior: 1 question per page.
- Navigation: "Next Page" / "Previous Page" buttons or direct click on Question Navigator.
- Footer controls: Page indicator ("Page 1 of 10"), "Previous Page", "Next Page", "Submit Quiz".

### Template B: Single-page scroll mode

- Behavior: All questions listed on one scrollable page.
- Navigation: Vertical scroll or click on Question Navigator.
- Footer controls: Single "Submit Quiz" button at bottom.

## 2. Key UI Component Specifications

### 2.1 Header bar

- Position: Fixed top bar.
- Elements:
  - Quiz title: Bold header (e.g., "Quiz 1: Computer Networks Mock").
  - Timer display: Live countdown ("Time Limit: 00:45:30 remaining") with warning icon when < 5 minutes remain.
  - Exit control: "Exit Quiz" button.

### 2.2 Question navigator (Side map)

- Position: Left-hand side panel, next to the question.
- Components:
  - Question grid: Numbered buttons ("1", "2", "3"...).
  - Status styling:
    - Unanswered: White background with dark border.
    - Answered: Blue background.
    - Current: Bold highlight border.
    - Flagged: Bookmark/flag icon on corner.

### 2.3 Question card area

- Header line: "Question 1", a Saving / Saved status and a bookmark toggle to flag the question.
- Question text: Prompt text.
- Answer inputs:
  - MCQ: Radio buttons (single choice).
  - Multiple select: Checkboxes (multiple choice).
  - True/False: Radio buttons ("True" / "False").
  - Short answer: Text input box.
  - Fill in the blanks: One text input per blank inside the prompt.

### 2.4 Submit confirmation modal

- Trigger: Clicking "Submit Quiz".
- Content:
  - Warning banner listing unanswered questions (e.g., "Unanswered: Q3, Q7").
  - Notice: "Submitting will end your attempt."
  - Action buttons: "Submit Quiz" (Confirm) and "Back to Quiz" (Cancel).

### 2.5 Results & review view

- Summary header: Total score (e.g., "8.5 / 10"), time taken, status.
- Question review: Student answer vs correct answer, points per question ("1/1 point"), and explanation.
- Scoring: Every question type is all or nothing, so a question earns full points only when the whole answer is correct. Short answers and blanks ignore case and surrounding spaces; a short answer may list several accepted answers.

## 3. Community library

- The Community Library button in the top bar opens a page of its own, next to Test Creator and Saved Library. It lists the tests in `src/data/community/<preset id>/`, sorted by title, with the Saved library card: the course code, the title, the question and minute counts, Start Quiz and Export. There is no Delete.
- Each file is quiz JSON in the importer format (what the AI returns). It goes through the importer with the time, layout and proctoring of the preset its folder names (for example `itg/` gives the ITG Java settings: one scrolling page, proctored). It keeps its own title. The file name is the test id; an id inside the file is ignored. A file the importer refuses fails the build and the tests.
- Start Quiz begins the quiz at once. The test is also copied to the Saved library under the id `community-<id>`, so it works offline.
- An empty folder shows "No tests published yet".
- To add a test, put its JSON file in the folder of its preset, such as `src/data/community/itg/`, and open a pull request; it ships with the next deploy.
