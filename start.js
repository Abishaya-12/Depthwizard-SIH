const { spawn, spawnSync } = require('child_process');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const root = __dirname;

console.log('Building frontend...');
const build = spawnSync(npmCommand, ['run', 'build', '--workspace', 'frontend'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

console.log('Starting DepthWizard at http://127.0.0.1:5000');
const backend = spawn('python', ['backend.py'], {
  cwd: root,
  stdio: 'inherit',
});

process.on('SIGINT', () => {
  backend.kill();
  process.exit(0);
});
