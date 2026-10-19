const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Read script.js content
const scriptCode = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

// Mock DOM elements and methods
const mockElement = {
  innerText: '',
  value: '',
  classList: { remove: () => {}, add: () => {} },
  setAttribute: () => {},
  getAttribute: () => null,
  addEventListener: () => {}
};

const sandbox = {
  console: console,
  URLSearchParams: global.URLSearchParams,
  AbortController: global.AbortController,
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: {
    documentElement: mockElement,
    getElementById: () => mockElement,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  window: { location: { search: '', href: 'http://localhost/' } }
};

const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(scriptCode, sandbox);

const {
  convertIsbnTo13,
  normalizeIsbn,
  matchesTargetIsbn,
  trimCatalogPunctuation,
  cleanAuthorName,
  fetchBookFromKnihovnyCz
} = sandbox;

console.log("--- TEST 1: ISBN-10 to ISBN-13 Conversion ---");
assert.strictEqual(convertIsbnTo13("80-257-0367-2"), "9788025703670");
assert.strictEqual(convertIsbnTo13("978-80-257-0367-0"), "9788025703670");
console.log("✓ ISBN conversion passed!");

console.log("--- TEST 2: Punctuation & Author Cleaning ---");
assert.strictEqual(trimCatalogPunctuation("Argo,"), "Argo");
assert.strictEqual(trimCatalogPunctuation("Praha :"), "Praha");
assert.strictEqual(trimCatalogPunctuation("[Praha] :"), "[Praha]");
assert.strictEqual(cleanAuthorName("Jean de Nostredame, asi 1507-1577"), "Jean de Nostredame");
assert.strictEqual(cleanAuthorName("Josef Prokop, 1971-"), "Josef Prokop");
console.log("✓ Cleaning functions passed!");

console.log("--- TEST 3: Matching ISBN in Array ---");
const sampleIsbns = ["978-80-257-0367-0", "80-202-0468-7 (brož.)"];
assert.strictEqual(matchesTargetIsbn(sampleIsbns, "9788025703670"), true);
assert.strictEqual(matchesTargetIsbn(sampleIsbns, "9788020204684"), true);
assert.strictEqual(matchesTargetIsbn(sampleIsbns, "9780000000000"), false);
console.log("✓ ISBN matching passed!");

console.log("--- TEST 4: Parsing Sample Response from Knihovny.cz ---");
const sampleApiResponse = {
  "resultCount": 1,
  "records": [{
    "id": "mkp.3521868",
    "title": "Životy slavných a starých provensálských básníků, kteří žili v dobách hrabat z kraje Provença",
    "authors": {
      "primary": { "Jean de Nostredame, asi 1507-1577": [] },
      "secondary": { "Josef Prokop, 1971-": [], "Vojtěch Domlátil, 1979-": [] },
      "corporate": []
    },
    "publishers": ["Argo,"],
    "placesOfPublication": ["Praha :"],
    "publicationDates": ["2011"],
    "physicalDescriptions": ["218 s. : il. ; 22 cm"],
    "isbns": ["978-80-257-0367-0"],
    "issns": [],
    "cnb": "cnb002163342",
    "formats": ["0/BOOKS/"]
  }],
  "status": "OK"
};

// Mock fetch for fetchBookFromKnihovnyCz
sandbox.fetch = async (url) => {
  assert(url.includes("https://www.knihovny.cz/api/v1/search?"));
  assert(url.includes("lookfor=9788025703670"));
  assert(url.includes("type=ISN"));
  assert(url.includes("limit=10"));
  assert(url.includes("field%5B%5D=id") || url.includes("field[]=id"));
  return {
    ok: true,
    json: async () => sampleApiResponse
  };
};

fetchBookFromKnihovnyCz("80-257-0367-2").then(book => {
  assert.ok(book, "Book should not be null");
  assert.strictEqual(book.isbn, "9788025703670");
  assert.strictEqual(book.title, "Životy slavných a starých provensálských básníků, kteří žili v dobách hrabat z kraje Provença");
  assert.strictEqual(book.author, "Jean de Nostredame");
  assert.strictEqual(book.publisher, "Argo");
  assert.strictEqual(book.year, "2011");
  assert.strictEqual(book.pages, "218 s. : il. ; 22 cm");
  assert.strictEqual(book.cnb, "cnb002163342");
  assert.strictEqual(book.cover, "https://www.knihovny.cz/Cover/Show?id=mkp.3521868&size=medium");
  console.log("✓ Sample response parsing passed perfectly!");
  console.log("ALL TESTS PASSED SUCCESSFULLY!");
}).catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
