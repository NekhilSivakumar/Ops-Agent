const { exec } = require('child_process');
const path = require('path');

const DEMO_REPO_PATH = path.join(__dirname, 'demo-repo');

function executeGitCommand(command) {
  return new Promise((resolve) => {
    exec(command, { cwd: DEMO_REPO_PATH }, (error, stdout, stderr) => {
      resolve({ success: !error, output: stdout || stderr || error?.message });
    });
  });
}
const express = require('express');
const cors = require('cors');
const { translate } = require('./translate');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/translate', async (req, res) => {
  const result = await translate(req.body.input);
  res.json(result);
});
app.post('/execute', async (req, res) => {
  const result = await executeGitCommand(req.body.command);
  res.json(result);
});
app.listen(3001, () => console.log('Translation API running on http://localhost:3001'));    