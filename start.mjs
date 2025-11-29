import { createRequire } from 'module';
import { spawn } from 'child_process';

const require = createRequire(import.meta.url);

const env = process.env;
const startFrontend = env.START_FRONTEND_PREVIEW === 'true';

require('./backend/dist/server.js');

if (startFrontend) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const preview = spawn(npmCmd, ['run', 'preview'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  preview.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
