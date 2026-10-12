import { execFileSync, spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// No external backend URL is accepted: every run owns a fresh database and backend.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, '../quarkus');
const runId = `angular-quiz-${randomUUID()}`;
const label = 'japanese-learning.angular-quiz-test';
const network = runId;
const database = `${runId}-db`;
const application = `${runId}-api`;
const image = `${runId}:test`;
const password = randomUUID();
const issuer = 'angular-kanji-quiz-integration';
const subject = `${runId}-player`;
const containers = [];
let networkCreated = false;
let imageCreated = false;
let child;
let stopped = false;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: runId, alg: 'RS256', use: 'sig' };
const server = createServer((request, response) => {
  if (request.url !== '/jwks') {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ keys: [jwk] }));
});

function docker(args, options = {}) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120_000,
    ...options,
  }).trim();
}

function jwt(role, user = subject, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = `${encode({ alg: 'RS256', kid: runId, typ: 'JWT' })}.${encode({
    iss: issuer,
    aud: 'JapaneseLearning',
    sub: user,
    role,
    iat: now,
    exp: now + 3600,
    ...overrides,
  })}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}

async function untilReady(check, description) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (stopped) throw new Error('Verification interrupted.');
    try {
      if (await check()) return;
    } catch {
      // Startup checks are retried; the final failure identifies the unavailable service.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${description} was not ready within 120 seconds.`);
}

function sql(statement) {
  return docker(
    [
      'exec',
      '-i',
      '--env',
      'MYSQL_PWD',
      database,
      'mysql',
      '-uroot',
      '--default-character-set=utf8mb4',
      'angular_quiz_test',
    ],
    {
      env: { ...process.env, MYSQL_PWD: password },
      input: statement,
    },
  );
}

function startContainer(name, args, environment) {
  docker(
    ['run', '-d', '--name', name, '--label', `${label}=${runId}`, '--network', network, ...args],
    { env: { ...process.env, ...environment } },
  );
  containers.push(name);
}

function owned(kind, name) {
  return (
    docker([
      kind,
      'inspect',
      '--format',
      `{{ index .${kind === 'network' ? '' : 'Config.'}Labels "${label}" }}`,
      name,
    ]) === runId
  );
}

async function command(executable, args, environment = {}) {
  return new Promise((resolve, reject) => {
    child = spawn(executable, args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...environment },
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      child = undefined;
      code === 0
        ? resolve()
        : reject(new Error(`Verification command exited with status ${code}.`));
    });
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopped = true;
    child?.kill(signal);
  });
}

try {
  console.log('Building the checked-out backend (source files remain read-only).');
  await command('docker', ['build', '--tag', image, backend]);
  imageCreated = true;
  docker(['network', 'create', '--label', `${label}=${runId}`, network]);
  networkCreated = true;
  startContainer(
    database,
    [
      '--tmpfs',
      '/var/lib/mysql:rw',
      '--env',
      'MYSQL_ROOT_PASSWORD',
      '--env',
      'MYSQL_DATABASE=angular_quiz_test',
      'mysql:8.4@sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb',
    ],
    { MYSQL_ROOT_PASSWORD: password },
  );
  await untilReady(() => sql('SELECT 1;').includes('1'), 'Isolated MySQL');
  const migrations = resolve(backend, 'src/main/resources/db/migration');
  for (const file of readdirSync(migrations)
    .filter((name) => /^V\d+__.*\.sql$/.test(name))
    .sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]))) {
    sql(readFileSync(resolve(migrations, file), 'utf8'));
  }
  // Master data plus one pre-V8 snapshot: UNKNOWN must not be inferred from today's bank.
  sql(`
    INSERT INTO lessons(id,level_id,lesson_number,title,display_order) VALUES (9001,1,9001,'Integration lesson',9001),(9002,1,9002,'Example lesson',9002);
    INSERT INTO example_sentences(id,japanese_text,japanese_reading,meaning_vi,meaning_en)
      VALUES (9001,'学校へ行く。','がっこうへいく。','Test','Go to school.'),(9002,'学校へ行きます。','がっこうへいきます。','Test','Go to school.');
    INSERT INTO quiz_sessions(id,user_subject,status,question_count,completed_at)
      VALUES (9001,'${subject}','COMPLETED',1,CURRENT_TIMESTAMP(6));
    INSERT INTO quiz_session_questions(id,session_id,question_version,question_number,source_type,sentence_reading,target_start,target_length,target_reading)
      VALUES (9001,9001,1,0,'CUSTOM','むかし',0,3,'むかし');
    INSERT INTO quiz_session_options(id,session_question_id,option_text,is_correct)
      VALUES (9001,9001,'昔',1),(9002,9001,'今',0),(9003,9001,'朝',0),(9004,9001,'夜',0);
    INSERT INTO quiz_answers(session_question_id,selected_option_id) VALUES (9001,9001);
  `);
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  const jwksPort = server.address().port;
  startContainer(
    application,
    [
      '--publish',
      '127.0.0.1::8080',
      '--env',
      'DB_USERNAME=root',
      '--env',
      'DB_PASSWORD',
      '--env',
      `DB_REACTIVE_URL=mysql://${database}:3306/angular_quiz_test`,
      '--env',
      `AUTH_JWKS_URL=http://host.docker.internal:${jwksPort}/jwks`,
      '--env',
      `AUTH_JWT_ISSUER=${issuer}`,
      '--env',
      'AUTH_JWT_AUDIENCE=JapaneseLearning',
      '--env',
      'APP_LOG_FILE_ENABLED=false',
      '--env',
      'QUARKUS_HTTP_CORS_ENABLED=true',
      '--env',
      'QUARKUS_HTTP_CORS_ORIGINS=*',
      image,
    ],
    { DB_PASSWORD: password },
  );
  const port = docker(['port', application, '8080/tcp']).split(':').at(-1);
  const baseUrl = `http://127.0.0.1:${port}/api`;
  await untilReady(async () => {
    const response = await fetch(`${baseUrl}/v1/kanji-quiz/config`, {
      headers: { Authorization: `Bearer ${jwt('User')}` },
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  }, 'Isolated Quarkus with test JWT authentication');
  const specification = await fetch(`http://127.0.0.1:${port}/q/openapi?format=json`);
  if (!specification.ok) throw new Error('Live OpenAPI is unavailable.');
  const openapi = await specification.json();
  for (const path of [
    '/api/v1/kanji-quiz/progress',
    '/api/v1/kanji-quiz/progress/breakdown',
    '/api/v1/kanji-quiz/history/{sessionId}',
    '/api/v1/admin/kanji-quiz/questions/import',
  ]) {
    if (!openapi.paths[path]) throw new Error(`Live OpenAPI is missing ${path}.`);
  }
  console.log('Isolated backend ready. Running Angular live HTTP integration scenarios.');
  await command(
    process.execPath,
    [
      'node_modules/@angular/cli/bin/ng.js',
      'test',
      '--watch=false',
      '--include=src/app/features/kanji-quiz/testing/quiz-live.integration.spec.ts',
    ],
    {
      KANJI_QUIZ_ISOLATED_TEST: JSON.stringify({
        runId,
        baseUrl,
        subject,
        admin: jwt('Admin', `${runId}-admin`),
        player: jwt('User'),
        foreign: jwt('User', `${runId}-foreign`),
        wrongRole: jwt('user'),
        expired: jwt('User', subject, { exp: 1 }),
        wrongIssuer: jwt('User', subject, { iss: 'wrong' }),
        wrongAudience: jwt('User', subject, { aud: 'wrong' }),
      }),
    },
  );
} catch (error) {
  // Do not print command arguments/environment: they may contain ephemeral credentials.
  console.error(error instanceof Error ? error.message : 'Integration verification failed.');
  process.exitCode = 1;
} finally {
  server.close();
  for (const container of containers.reverse()) {
    try {
      if (!owned('container', container)) throw new Error('Ownership label does not match.');
      docker(['rm', '--force', '--volumes', container]);
    } catch {
      console.error(`Could not clean up owned test container ${container}.`);
      process.exitCode = 1;
    }
  }
  if (networkCreated) {
    try {
      if (!owned('network', network)) throw new Error('Ownership label does not match.');
      docker(['network', 'rm', network]);
    } catch {
      console.error(`Could not clean up test network ${network}.`);
      process.exitCode = 1;
    }
  }
  if (imageCreated) docker(['image', 'rm', image]);
  console.log('Isolated test cleanup finished; existing development containers were not targeted.');
}
