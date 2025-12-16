import { chunkdown } from '../chunkdown';

const text = `# Code Examples

Here is an example function:

\`\`\`javascript
function calculateSum(numbers) {
  return numbers.reduce((acc, num) => acc + num, 0);
}

const result = calculateSum([1, 2, 3, 4, 5]);
console.log(result); // 15
\`\`\`

This function can be used to add numbers together.
`;

const codeSplitter = chunkdown({
  chunkSize: 50,
  rules: {
    // Never split code blocks
    code: { split: 'never-split' },
  },
});
const { chunks } = codeSplitter.split(text);
// [
//   '# Code Examples\n\nHere is an example function:',
//   `\`\`\`javascript
//     function calculateSum(numbers) {
//       return numbers.reduce((acc, num) => acc + num, 0);
//     }

//     const result = calculateSum([1, 2, 3, 4, 5]);
//     console.log(result); // 15
//     \`\`\``,
//   'This function can be used to add numbers together.',
// ];
