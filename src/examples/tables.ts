import { chunkdown } from '../chunkdown';

const splitter = chunkdown({
  chunkSize: 100,
  maxOverflowRatio: 1.0,
});

const text = `
| Name     | Age | Country | Occupation        | Email                  |
|----------|-----|---------|-------------------|------------------------|
| Alice    | 30  | USA     | Software Engineer | alice@example.com      |
| Bob      | 25  | UK      | Designer          | bob@example.com        |
| Charlie  | 35  | Canada  | Product Manager   | charlie@example.com    |
| David    | 40  | France  | Data Scientist    | david@example.com      |
`;

const { chunks } = splitter.split(text);
// Each chunk contains one or more rows and the header row
// [
//   '| Name | Age | Country | Occupation | Email |
//   | - | - | - | - | - |
//   | Alice | 30 | USA | Software Engineer | <alice@example.com> |
//   | Bob | 25 | UK | Designer | <bob@example.com> |',
//   '| Name | Age | Country | Occupation | Email |
//   | - | - | - | - | - |
//   | Charlie | 35 | Canada | Product Manager | <charlie@example.com> |
//   | David | 40 | France | Data Scientist | <david@example.com> |',
// ];

console.dir(chunks, { depth: null });

// const splitter = chunkdown({
//   chunkSize: 50,
//   maxOverflowRatio: 1.0,
// });

// const chunks = splitter.splitText(text);
// Each chunk is a cell and their corresponding header row
// [
//   '| Name |
//   | - |
//   | Alice |',
//   '| Age |
//   | - |
//   | 30 |',
//   '| Country |
//   | - |
//   | USA |',
//   '| Occupation |
//   | - |
//   | Software Engineer |',
//   '| Email |
//   | - |
//   | <alice@example.com> |',
//   ...
//   '| Name |
//   | - |
//   | David |',
//   '| Age |
//   | - |
//   | 40 |',
//   '| Country |
//   | - |
//   | France |',
//   '| Occupation |
//   | - |
//   | Data Scientist |',
//   '| Email |
//   | - |
//   | <david@example.com> |',
// ];
