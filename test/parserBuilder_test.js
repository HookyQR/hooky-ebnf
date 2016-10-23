'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const EBNF = require('../ebnf');
const ParserBuilder = require('../parserBuilder');


const d = (a, n) => console.log(require('util').inspect(a, { depth: n, colors: true }));

describe("parser generator", function() {
  let result;
  let input;
  let ebnf;
  beforeEach(() => input = new EBNF(ebnf).syntax);
  context("with the EBNF for EBNF", function() {
    let options;
    before(() => {
      ebnf = fs.readFileSync(__dirname + '/ebnf.ebnf');
      options = {
        special: {
          'IS0 6429 character Horizontal Tabulation': data => data.current === 0x09,
          'IS0 6429 character Carriage Return': data => data.current === 0x0a,
          'IS0 6429 character Line Feed': data => data.current === 0x0d,
          'IS0 6429 character Vertical Tabulation': data => data.current === 0x0b,
          'IS0 6429 character Form Feed': data => data.current === 0x0c,
          'a syntactic-factor that could be replaced by a syntactic-factor containing no meta-identifiers': ParserBuilder.ensureNoLoop
        }
      };
    });
    it("doesn't raise an exception", function() {
      expect(() => result = new ParserBuilder(input, options)).not.to.throw();
      d(input[34], 5);
    });
    it("has a 'metaIdentifier' method", function() {
      result = new ParserBuilder(input, options);
      expect(result.methods).to.have.property('metaIdentifier').that.is.a('function');
    });
  });
});