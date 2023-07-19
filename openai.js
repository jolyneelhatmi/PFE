const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const { Configuration, OpenAIApi } = require("openai");
const cors = require('cors');
const app = express();
let apiKey = "";
const INSTRUCTIONS = `<<PUT THE PROMPT HERE>>`;
const TEMPERATURE = 0.5;
const MAX_TOKENS = 500;
const FREQUENCY_PENALTY = 0;
const PRESENCE_PENALTY = 0.6;
const MAX_CONTEXT_QUESTIONS = 10;
const usersRoutes = {}; // Dictionary to store routes separately for each user
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cors());

app.post('/AddAPI', (req, res) => {
  const key = Object.keys(req.body)[0];
  apiKey = key;
  res.sendStatus(200);
});

async function getResponse(instructions, previousQuestionsAndAnswers, newQuestion) {
  const openai = new OpenAIApi(new Configuration({
    apiKey: apiKey
  }));
  const messages = [
    { role: 'system', content: instructions },
  ];

  for (const [question, answer] of previousQuestionsAndAnswers.slice(-MAX_CONTEXT_QUESTIONS)) {
    messages.push({ role: 'user', content: question });
    messages.push({ role: 'assistant', content: answer });
  }

  messages.push({ role: 'user', content: newQuestion });

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      top_p: 1,
      frequency_penalty: FREQUENCY_PENALTY,
      presence_penalty: PRESENCE_PENALTY
    });

    if (completion.data && completion.data.choices && completion.data.choices.length > 0) {
      return completion.data.choices[0].message.content;
    } else {
      throw new Error('Invalid completion response');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

app.post('/create-route', (req, res) => {
  const { userId, route } = req.body;
  const userRoutes = usersRoutes[userId] || new Map();

  const routePath = `/${route}`;

  if (userRoutes.has(route)) {
    userRoutes.delete(route);
  }

  userRoutes.set(route, routePath);
  userRoutes.set(route, []);

  // Save the userRoutes map in the dictionary for this user
  usersRoutes[userId] = userRoutes;

  res.json({ message: 'Route Created' });
});

app.post('/:userId/:route', async (req, res) => {
  const { userId, route } = req.params;
  const userRoutes = usersRoutes[userId];

  if (!userRoutes) {
    res.sendStatus(404);
    return;
  }

  if (userRoutes.has(route)) {
    const input = req.body.input;
    const previousQuestionsAndAnswers = userRoutes.get(route);
    const response = await getResponse(INSTRUCTIONS, previousQuestionsAndAnswers, input.trim());
    previousQuestionsAndAnswers.push([input.trim(), response]);
    res.json({ answer: response });
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
