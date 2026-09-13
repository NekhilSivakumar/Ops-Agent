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

app.listen(3001, () => console.log('Translation API running on http://localhost:3001'));    