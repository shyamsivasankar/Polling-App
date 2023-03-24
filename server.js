const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = 'mongodb+srv://shyamshivshankar:moushya023098@articles.6wktik4.mongodb.net/pollingLists?retryWrites=true&w=majority'
// const MONGODB_URI = process.env.MONGODB_URI

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const pollingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  candidates: [{ name: { type: String, required: true }, votes: { type: Number, default: 0 } }],
});

const Poll = mongoose.model('Poll', pollingSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.sendFile('index');
});

app.post('/create-poll', async (req, res) => {
  try {
    const poll = new Poll({
      title: req.body.title,
      candidates: req.body.candidates.map(candidate => ({ name: candidate })),
    });

    await poll.save();
    res.redirect(`/poll/${poll._id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/poll/:id', async (req, res) => {
  try {
    const polls = await Poll.findById(req.params.id);

    if (!polls) {
      return res.status(404).send('Poll not found');
    }
    res.render('poll', { polls : polls });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

io.on('connection', socket => {
  socket.on('join', async ({ id }) => {
    try {
      const poll = await Poll.findById(id);

      if (!poll) {
        return socket.emit('error', { message: 'Poll not found' });
      }

      socket.join(id);
      io.to(id).emit('poll', poll);
    } catch (error) {
      console.error(error);
      socket.emit('error', { message: 'Internal Server Error' });
    }
  });

  socket.on('vote', async ({ id, candidateIndex }) => {
    try {
      const poll = await Poll.findById(id);

      if (!poll) {
        return socket.emit('error', { message: 'Poll not found' });
      }

      const candidate = poll.candidates[candidateIndex];

      if (!candidate) {
        return socket.emit('error', { message: 'Candidate not found' });
      }

      candidate.votes++;
      await poll.save();

      io.to(id).emit('poll', poll);
    } catch (error) {
      console.error(error);
      socket.emit('error', { message: 'Internal Server Error' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server up and running`);
});
