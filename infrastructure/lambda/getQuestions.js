const questions = require('./questions.json');

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-User-Id',
  };

  try {
    const count = parseInt(event.queryStringParameters?.count || '10', 10);
    const category = event.queryStringParameters?.category;
    const difficulty = event.queryStringParameters?.difficulty;

    let filteredQuestions = [...questions];

    if (category) {
      filteredQuestions = filteredQuestions.filter(q => 
        q.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (difficulty) {
      filteredQuestions = filteredQuestions.filter(q => 
        q.difficulty.toLowerCase() === difficulty.toLowerCase()
      );
    }

    const shuffled = shuffleArray(filteredQuestions);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        questions: selected,
        total: questions.length,
        returned: selected.length,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
