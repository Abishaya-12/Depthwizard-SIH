const { spawn } = require('child_process');
const path = require('path');

const root = __dirname;
const frontendDir = path.join(root, 'frontend');

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`${command} exited with signal ${signal}`);
    } else if (code !== 0) {
      console.error(`${command} exited with code ${code}`);
    }
  });

  return child;
}

console.log('Starting DepthWizard backend and frontend...');

const backend = start('python', ['backend.py'], { cwd: root });
const frontend = start('D:\\npm.cmd', ['run', 'dev', '--', '--host', '0.0.0.0'], { cwd: frontendDir });

backend.on('exit', () => {
  frontend.kill();
  process.exit(1);
});

frontend.on('exit', () => {
  backend.kill();
  process.exit(1);
});

process.on('SIGINT', () => {
  frontend.kill();
  backend.kill();
  process.exit(0);
});
