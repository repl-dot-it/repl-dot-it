// Modules
const fs = require('fs');
const spawn = require('child_process').spawn;
const express = require('express');
// Express
const app = express();

app.use(express.urlencoded({
  extended: true
}))
// Map of our repls that we have saved

// Stuff for saving
let genRandomString = () => Math.random().toString(36).replace(/[^a-z]+/g, '').substring(0,5);
let Saved_Repls = new Map();

// Deal with Static Files
app.use(express.static('Public'));

// Deal with providing the main index under most circumstances
app.get(/^\/(languages|help|about|examples|workspace)/, (req, res) => {
  res.sendFile('./Public/index.html', { root: __dirname });
});

// Deal with people trying to save there repls
app.post('/save', (req, res) => {
  let thisRandom = genRandomString();
  Saved_Repls.set(thisRandom, req.body)
  res.json({
    session_id: String(thisRandom),
    revision_id: '1'
  });
});

// Deal with remaining routes
app.get('*', async (req, res) => {
  let Name = req.url.split('/').filter(e => e);
  if (Name[0] && Saved_Repls.has(Name[0])) {
    let file = await fs.promises.readFile('./Public/index.html', 'utf-8');

    let savedData = Saved_Repls.get(Name[0])
    let sessionReturnData = {
      session_id: Name[0],
      revision_id: "1",
      eval_history: JSON.parse(savedData.eval_history),
      editor_text: savedData.editor_text,
      language: savedData.language,
      console_dump: savedData.console_dump 
    };

    file = file.replace(
      'SESSION_PLACEHOLDER', `REPLIT_DATA=${JSON.stringify(sessionReturnData)}`
    );

    return res.send(file);
  }
  res.sendFile('./Public/index.html', { root: __dirname });
});

app.listen(3000, () => console.log('Listening on Port: 3000'));


// Cakefile Watcher
let watcher = spawn('npx', ['cake', 'watch']);
watcher.stdout.pipe(process.stdout);
watcher.stderr.pipe(process.stderr);