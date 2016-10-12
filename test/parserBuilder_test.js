'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const EBNF = require('../ebnf');
const ParserBuilder = require('../parserBuilder');

describe("parser generator", function () {
  let result;
  let input;
  let ebnf;
  before(() => input = new EBNF(ebnf).syntax);

});