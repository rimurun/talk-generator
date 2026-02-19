const messageText = [
  '',
  '1. **US military operation**',
  '   - \u30ab\u30c6\u30b4\u30ea: \u6d77\u5916\u304a\u3082\u3057\u308d',
  '   - \u8981\u7d04: Test summary here.',
  '',
  '2. **India AI hub**',
  '   - \u30ab\u30c6\u30b4\u30ea: \u6d77\u5916\u304a\u3082\u3057\u308d',
  '   - \u8981\u7d04: Another summary.',
].join('\n');

const lines = messageText.split('\n');
let currentTopic = {};
let topicCount = 0;
const topics = [];

for (let i = 0; i < lines.length && topicCount < 15; i++) {
    const line = lines[i].trim();
    if (line.match(/^\d+\.\s*\*\*.*\*\*/) || line.match(/^\d+\.\s*.+/) || line.match(/^\*\*.*\*\*/)) {
        if (currentTopic.title) {
            topics.push({...currentTopic});
            topicCount++;
        }
        let title = line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
        currentTopic = { title, summary: '', _gptCategory: null };
    }
    else if (line.match(/\u30ab\u30c6\u30b4\u30ea[\uff1a:]\s*/)) {
        const catMatch = line.replace(/.*\u30ab\u30c6\u30b4\u30ea[\uff1a:]\s*/, '').trim();
        currentTopic._gptCategory = catMatch;
        console.log('Found cat:', catMatch);
    }
    else if (line && !line.match(/^[\s]*$/) && currentTopic.title) {
        const cleaned = line.replace(/^-\s*/, '');
        currentTopic.summary += cleaned;
    }
}
if (currentTopic.title) topics.push({...currentTopic});

console.log('Total:', topics.length);
topics.forEach(t => console.log(t._gptCategory, t.title));