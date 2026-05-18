require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/orgs', require('./routes/orgs'));
app.use('/api/recipients', require('./routes/recipients'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/audit', require('./routes/audit'));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  initDb()
    .then(() => app.listen(PORT, () => console.log(`RemitBridge API on :${PORT}`)))
    .catch(e => { console.error('DB init failed', e); process.exit(1); });
}

module.exports = app;
