import { execFileSync } from 'node:child_process';
import { randomUUID, randomInt } from 'node:crypto';
import { test as base, expect } from '@playwright/test';

// Stay below the unchanged gateway login/register budget (10 requests/minute).
let nextAuth = Date.now() + 6500;
export async function paceAuth() {
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextAuth - Date.now())));
  nextAuth = Date.now() + 6500;
}

function docker(args, input) {
  try {
    return execFileSync('docker', args, {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Database CLI diagnostics can contain credentials. Never include stdout/stderr.
    throw new Error('Quiz E2E Docker operation failed; inspect the named development service.');
  }
}

export const test = base.extend({
  fixtures: async ({ request }, use) => {
    if (process.env['QUIZ_E2E_PROJECT'] !== 'jp_learning_dev') {
      throw new Error(
        'Set QUIZ_E2E_PROJECT=jp_learning_dev to allow isolated fixtures in the existing development stack.',
      );
    }
    const containers = {};
    for (const service of [
      'mysql',
      'sqlserver',
      'user-api',
      'vocabulary-api',
      'gateway',
      'frontend',
    ]) {
      const name = `jp_learning_dev-${service}-1`;
      const info = JSON.parse(docker(['inspect', name]))[0];
      expect(info.Config.Labels['com.docker.compose.project']).toBe('jp_learning_dev');
      expect(info.State.Health.Status).toBe('healthy');
      expect(info.Config.Labels['com.docker.compose.project.config_files']).not.toContain(
        'production',
      );
      containers[service] = info;
    }
    const db = containers['user-api'].Config.Env.find((v) => v.startsWith('Database__Name=')).split(
      '=',
    )[1];
    if (!/^[A-Za-z0-9_]+$/.test(db)) throw new Error('Unsupported development database name.');
    const sql = (query) =>
      docker(
        [
          'exec',
          '-i',
          'jp_learning_dev-sqlserver-1',
          'sh',
          '-c',
          `SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1 -U sa -C -b -d ${db}`,
        ],
        query,
      );
    const mysql = (query) =>
      docker(
        [
          'exec',
          '-i',
          'jp_learning_dev-mysql-1',
          'sh',
          '-c',
          'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u "$MYSQL_USER" "$MYSQL_DATABASE" -N -B',
        ],
        query,
      );
    const marker = `quiz-e2e-${randomUUID()}`;
    const accounts = [];
    let lessonId;
    const levelId = Number(mysql('SELECT id FROM jlpt_levels ORDER BY id LIMIT 1;'));
    expect(Number.isSafeInteger(levelId) && levelId > 0).toBe(true);
    try {
      for (const role of ['admin', 'player', 'other']) {
        const account = {
          username: `${marker}-${role}`,
          email: `${marker}-${role}@example.invalid`,
          password: `E2e!${randomUUID()}`,
        };
        accounts.push(account); // Cleanup by exact generated email even if response validation fails.
        await paceAuth();
        const result = await request.post('/api/auth/register', { data: account });
        expect(result.status(), 'register isolated account').toBe(201);
        const body = await result.json();
        account.id = (body.data ?? body).id;
        expect(account.id).toMatch(/^[\da-f-]{36}$/i);
      }
      sql(
        `UPDATE dbo.Users SET Role = 2 WHERE Id = '${accounts[0].id}' AND Email = '${accounts[0].email}';`,
      );
      const number = randomInt(1_000_000, 2_000_000_000);
      lessonId = Number(
        mysql(
          `INSERT INTO lessons(level_id,lesson_number,title,display_order) VALUES (${levelId},${number},'${marker}',${number}); SELECT LAST_INSERT_ID();`,
        ),
      );
      expect(Number.isSafeInteger(lessonId) && lessonId > 0).toBe(true);
      await use({
        marker,
        lessonId,
        levelId,
        admin: accounts[0],
        player: accounts[1],
        other: accounts[2],
        seedClassificationHistory() {
          // Historical UNKNOWN snapshots cannot be created by the current API.
          // Only this run's new player is touched; existing cleanup cascades snapshots.
          const statements = ['START TRANSACTION;'];
          for (const captured of [false, true]) {
            const count = captured ? 2 : 1;
            statements.push(
              `INSERT INTO quiz_sessions(user_subject,status,question_count,completed_at) VALUES ('${accounts[1].id.toLowerCase()}','COMPLETED',${count},UTC_TIMESTAMP(6)); SET @fixture_session=LAST_INSERT_ID();`,
            );
            for (let index = 0; index < count; index++) {
              statements.push(`INSERT INTO quiz_session_questions(session_id,question_version,question_number,source_type,sentence_reading,target_start,target_length,target_reading,classifications_captured) VALUES (@fixture_session,1,${index},'CUSTOM','test',0,4,'test',${captured ? 1 : 0}); SET @fixture_question=LAST_INSERT_ID();
INSERT INTO quiz_session_options(session_question_id,option_text,is_correct) VALUES (@fixture_question,'correct',1); SET @fixture_correct=LAST_INSERT_ID();
INSERT INTO quiz_session_options(session_question_id,option_text,is_correct) VALUES (@fixture_question,'wrong',0); SET @fixture_wrong=LAST_INSERT_ID();
INSERT INTO quiz_session_options(session_question_id,option_text,is_correct) VALUES (@fixture_question,'other',0),(@fixture_question,'fourth',0);
INSERT INTO quiz_answers(session_question_id,selected_option_id) VALUES (@fixture_question,${index === 0 ? '@fixture_correct' : '@fixture_wrong'});`);
            }
          }
          mysql(statements.join('\n') + '\nCOMMIT;');
        },
      });
    } finally {
      const subjects = accounts
        .filter((a) => /^[\da-f-]{36}$/i.test(a.id ?? ''))
        .map((a) => `'${a.id.toLowerCase()}'`);
      if (subjects.length) {
        mysql(
          `DELETE FROM quiz_user_progress WHERE user_subject IN (${subjects}); DELETE FROM quiz_sessions WHERE user_subject IN (${subjects});`,
        );
      }
      // Do not delete a fixture if another developer has played it during this run.
      const foreignSnapshots = Number(
        mysql(
          `SELECT COUNT(*) FROM quiz_session_questions s JOIN quiz_questions q ON q.id=s.question_id WHERE q.explanation_en='${marker}';`,
        ),
      );
      if (foreignSnapshots !== 0)
        throw new Error(
          `Fixture ${marker} was used outside this run; retained for manual cleanup.`,
        );
      mysql(
        `DELETE FROM quiz_questions WHERE explanation_en='${marker}'; DELETE FROM lessons WHERE title='${marker}'${lessonId ? ` AND id=${lessonId}` : ''};`,
      );
      for (const account of accounts) {
        sql(
          `DELETE FROM dbo.RefreshTokens WHERE UserId IN (SELECT Id FROM dbo.Users WHERE Email='${account.email}'); DELETE FROM dbo.Users WHERE Email='${account.email}';`,
        );
      }
      console.log(`Cleaned isolated fixture ${marker}`);
    }
  },
});
export { expect };

export async function login(page, account) {
  await paceAuth();
  if (new URL(page.url()).pathname !== '/login') await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

// Follow real Angular links; page.goto intentionally destroys memory-only auth.
export async function navigate(page, path) {
  const link = page.locator(`a[href="${path}"]`).first();
  await expect(link).toBeAttached();
  await link.click();
}
