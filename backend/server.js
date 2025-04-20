const express = require('express');
const app = express();

// Define a basic route
app.get('/', (req, res) => {
  res.send('Chat me up!');
});

// Listen on port 3000
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
