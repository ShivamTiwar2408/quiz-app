const fs = require('fs');
const path = require('path');

const questionsDir = 'src/questions';
const allQuestions = [];
const topics = {};

const topicDirs = fs.readdirSync(questionsDir);

topicDirs.forEach(topic => {
  const topicPath = path.join(questionsDir, topic);
  if (!fs.statSync(topicPath).isDirectory()) return;
  
  topics[topic] = [];
  
  const files = fs.readdirSync(topicPath);
  files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const subtopic = file.replace('.json', '');
    topics[topic].push(subtopic);
    
    const content = JSON.parse(fs.readFileSync(path.join(topicPath, file), 'utf8'));
    content.forEach((q, idx) => {
      allQuestions.push({
        id: topic.replace(/\s+/g, '_') + '__' + subtopic + '__' + idx,
        topic: topic,
        subtopic: subtopic,
        ...q
      });
    });
  });
});

console.log('Total questions:', allQuestions.length);
console.log('Topics:', Object.keys(topics).length);

fs.writeFileSync('infrastructure/lambda/questions-data.json', JSON.stringify(allQuestions, null, 2));
fs.writeFileSync('infrastructure/lambda/topics.json', JSON.stringify(topics, null, 2));

console.log('Files written successfully!');
