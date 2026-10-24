import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const quizJson = readFileSync('e2e/fixtures/quiz.json', 'utf8');

async function importQuiz(page: Page, title = 'Browser quiz') {
  await page.goto('/');
  await page.getByRole('button', { name: 'I already have JSON' }).click();
  await page.getByLabel(/Test Title/).fill(title);
  await page.getByLabel('Quiz JSON').fill(quizJson);
  await page.getByRole('button', { name: 'Start Quiz Simulation Now' }).click();
}

const nextPage = (page: Page) =>
  page.getByRole('button', { name: 'Next Page' }).first().click();

test('opens on the creator', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Quiz Drill');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mock Test Creator' }),
  ).toBeVisible();
  await expect(page.getByLabel('Number of Questions')).toBeVisible();
  await expect(page.getByLabel('Quiz JSON')).toHaveCount(0);
});

test('fills the prompt options from a preset in the built app', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Exam preset (optional)').selectOption('devops');
  await page.getByRole('button', { name: 'Apply preset' }).click();

  await expect(page.getByLabel('Number of Questions')).toHaveValue('10');
  await expect(
    page.getByText('Applied DevOps Weekly Quiz to the prompt options.'),
  ).toBeVisible();

  // The user can still change what the preset filled in
  await page.getByLabel('Number of Questions').fill('7');
  await expect(page.getByLabel('Number of Questions')).toHaveValue('7');
});

test('warns about empty required options once the user moves below them, without losing the click', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByText(/Warning: Enter a number of questions/),
  ).toHaveCount(0);

  // The warnings appear above the button, so they must not move it mid-click
  const custom = page.getByRole('button', { name: 'Custom % Breakdown' });
  await custom.click();

  await expect(custom).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByText(/Warning: Enter a number of questions/),
  ).toBeVisible();
  await expect(
    page.getByText(/Warning: You must select at least one question type/),
  ).toBeVisible();
});

test('takes a quiz and finds the result in the history', async ({ page }) => {
  await importQuiz(page);

  await expect(page.getByRole('timer')).toContainText('remaining');
  await page.getByText('git branch', { exact: true }).click();
  await nextPage(page);
  await page.getByText('True', { exact: true }).click();
  await nextPage(page);
  await page.getByLabel('Answer', { exact: true }).fill('CloudFront');
  await expect(page.getByText('3 of 3 questions saved')).toBeVisible();

  await page.getByRole('button', { name: 'Submit Quiz' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit Quiz' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Quiz Submission Overview' }),
  ).toContainText('3 / 3 (100%)');

  await page.getByRole('button', { name: 'Back to Creator' }).first().click();
  await page.getByRole('button', { name: /Saved Library/ }).click();
  await page.getByRole('tab', { name: /Attempt History \(1\)/ }).click();
  await expect(page.getByText('Browser quiz').first()).toBeVisible();
});

test('starts ready JSON from step 2 with the title from the JSON', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'I already have JSON' }).click();
  await page.getByLabel('Quiz JSON').fill(quizJson);
  await page.getByRole('button', { name: 'Start Quiz Simulation Now' }).click();

  await expect(page.getByRole('timer')).toContainText('remaining');
  await expect(
    page.getByText(JSON.parse(quizJson).title).first(),
  ).toBeVisible();
});

test('scores a quiz with wrong answers', async ({ page }) => {
  await importQuiz(page);

  await page.getByText('git merge', { exact: true }).click();
  await page.getByRole('button', { name: 'Submit Quiz' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit Quiz' })
    .click();

  await expect(
    page.getByRole('region', { name: 'Quiz Submission Overview' }),
  ).toContainText('0 / 3 (0%)');
});

test('selects an option from anywhere on its highlighted row', async ({
  page,
}) => {
  await importQuiz(page);
  const option = page.getByRole('radio', { name: 'git merge' });
  const row = page.locator('label', { has: option }).locator('xpath=..');
  const box = await row.boundingBox();
  if (!box) throw new Error('option row is not visible');

  // Near the top and bottom edges, where the row is highlighted on hover
  await page.mouse.click(box.x + 4, box.y + 3);
  await expect(option).toBeChecked();

  const other = page.getByRole('radio', { name: 'git tag' });
  const otherBox = await page
    .locator('label', { has: other })
    .locator('xpath=..')
    .boundingBox();
  if (!otherBox) throw new Error('option row is not visible');
  await page.mouse.click(otherBox.x + 4, otherBox.y + otherBox.height - 3);
  await expect(other).toBeChecked();
});

test('keeps the quiz in the saved library after a reload', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await importQuiz(page, 'Kept quiz');
  await page.getByRole('button', { name: 'Exit quiz' }).click();

  await page.reload();
  const library = page.getByRole('button', { name: /Saved Library/ });
  await expect(library).toContainText('1');
  await library.click();

  await expect(page.getByText('Kept quiz')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Quiz' })).toBeVisible();
});

test('explains a broken JSON', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'I already have JSON' }).click();

  await page.getByLabel('Quiz JSON').fill('{"title": "Oops",');

  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(
    page.getByRole('button', { name: 'Start Quiz Simulation Now' }),
  ).toBeDisabled();
});

test('serves a health check for the container', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.ok()).toBe(true);
});

test('keeps the quiz visible when answering a lower question in scroll mode', async ({
  page,
}) => {
  const long = JSON.parse(quizJson);
  long.questions = Array.from({ length: 12 }, (_, i) => ({
    ...long.questions[0],
    id: `q${i + 1}`,
    number: i + 1,
    prompt: `Question text ${i + 1}?`,
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'I already have JSON' }).click();
  await page
    .getByRole('button', { name: 'Scroll Form (All Questions)' })
    .click();
  await page.getByLabel(/Test Title/).fill('Scroll quiz');
  await page.getByLabel('Quiz JSON').fill(JSON.stringify(long));
  await page.getByRole('button', { name: 'Start Quiz Simulation Now' }).click();

  const question = page.getByRole('group', { name: 'Question 8' });
  await question.scrollIntoViewIfNeeded();
  await question.getByText('git branch', { exact: true }).click();

  await expect(page.getByRole('timer')).toBeInViewport();
  await expect(
    question.getByText('git branch', { exact: true }),
  ).toBeInViewport();
});

test('lists the community tests and starts one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Community Library' }).click();

  const card = page
    .getByRole('region', { name: 'Community Library' })
    .getByRole('article')
    .first();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Start Quiz' }).click();

  await expect(page.getByRole('timer')).toContainText('remaining');
});
