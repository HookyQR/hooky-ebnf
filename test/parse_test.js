'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const EBNF = require('../ebnf');

describe("parser", function() {
  let result;
  context('parsing the ebnf for ebnf', function() {
    let d = fs.readFileSync(__dirname + '/ebnf.ebnf');
    it('does not raise an error', function() {
      expect(function() { result = new EBNF(d); }).not.to.throw();
      expect(result.syntax).to.have.length(53);
      expect(result.comments).to.have.length(5);
    });
  });
  context('parsing individual syntax rule', function() {
    let content = '';
    let comments;
    beforeEach(function() {
      expect(function() { result = new EBNF(`a=${content};`); }).not.to.throw();
      expect(result.syntax).to.have.deep.property('0.name', 'a');
      comments = result.comments;
      result = result.syntax[0];
      expect(result).to.have.length(3 + content.length);
      expect(result).to.have.deep.property('kind', 'syntax_rule');
      expect(result).to.have.deep.property('value');
      result = result.value;
    });
    ['', ' ', '\t', '\n', '\r\n\r\r'].forEach(empty => context(`empty sequence ${JSON.stringify(empty)}`, function() {
      before(() => content = empty);
      it('has no content', function() {
        expect(result).to.eql([]);
      });
    }));
    context('empty group', function() {
      before(() => content = '()');
      it('has a group that has no content', function() {
        expect(result).to.have.deep.property('0.kind', 'grouped_sequence');
        expect(result).to.have.deep.property('0.value').that.eqls([]);
      });
    });
    context('empty sequences', function() {
      const elements = {
        grouped: ['()'],
        repeated: ['{}', '(::)'],
        optional: ['[]', '(//)']
      };
      Object.keys(elements).forEach(type => context(`empty ${type}`, function() {
        elements[type].forEach(str => {
          context(`with ${JSON.stringify(str)}`, function() {
            before(() => content = str);
            it(`has a ${type}_sequence that has no content`, function() {
              expect(result).to.have.deep.property('0.kind', `${type}_sequence`);
              expect(result).to.have.deep.property('0.value').that.eqls([]);
            });
          });
        });
      }));
    });
    context('syntactic factor', function() {
      const elements = {
        '2*"a"': { count: 2 },
        '3*()': { count: 3, 'value.kind': 'grouped_sequence' }
      }
      Object.keys(elements).forEach(data => context("'" + data + "'", function() {
        before(() => content = data);
        it('has the expected elements', function() {
          const exp = elements[data];
          expect(result).to.have.deep.property('0.kind', 'syntactic_factor');
          Object.keys(exp).forEach(indivExp =>
            expect(result).to.have.deep.property('0.' + indivExp).that.eqls(exp[indivExp]));
        });
      }));
    });

    context('syntactic term', function() {
      const elements = {
        '"a"': { kind: 'terminal_string' }, // it drops through
        'b-"a"': { 'value.kind': 'meta_identifier', 'except.kind': 'terminal_string' },
        'b   -   "a"   ': { 'value.kind': 'meta_identifier', 'except.kind': 'terminal_string' },
        'b-("a")': { 'value.kind': 'meta_identifier', 'except.kind': 'grouped_sequence', 'except.value.0.kind': 'terminal_string' }
      }
      Object.keys(elements).forEach(data => context("'" + data + "'", function() {
        before(() => content = data);
        it('has the expected elements', function() {
          const exp = elements[data];
          Object.keys(exp).forEach(indivExp =>
            expect(result).to.have.deep.property('0.' + indivExp).that.eqls(exp[indivExp]));
        });
      }));
    });

    context('definitions list', function() {
      const elements = {
        '"a" | b': { 'kind': 'terminal_string' },
        'b | "a"': { 'kind': 'meta_identifier' },
        '("a"|b)': { 'kind': 'grouped_sequence', 'value.0.kind': 'terminal_string' },
        '{a|b}': { 'kind': 'repeated_sequence', 'value.0.kind': 'meta_identifier' }
      }
      Object.keys(elements).forEach(data => context("'" + data + "'", function() {
        before(() => content = data);
        it('has the expected elements', function() {
          const exp = elements[data];
          Object.keys(exp).forEach(indivExp =>
            expect(result).to.have.deep.property('0.' + indivExp).that.eqls(exp[indivExp]));
        });
      }));
    });


    context('comments', function() {
      const elements = {
        '"a" (* x *)': [6, 1],
        '(* xx *)': [2, 2],
        '((* xxx *)a|b)': [3, 3],
      }
      Object.keys(elements).forEach(data => context("'" + data + "'", function() {
        before(() => content = data);
        it('has comments in the correct position', function() {
          const exp = elements[data];
          expect(comments[0]).to.have.deep.property('position.character').that.eqls(exp[0]);
          expect(comments[0]).to.have.property('value').that.has.length(exp[1]);
          expect(comments[0]).to.have.deep.property('value.0').that.eqls('x');
        });
      }));
    });
  });

  context('multiple syntax rules', function() {
    const input = `
(* first *)
a b c = "a" | "b" (* second *)
    | "c";
b = ( a| "x") - (* third *);`;
    it(`>>>${input}<<< parses correctly`, function() {
      expect(function() {
        result = new EBNF(input);
      }).not.to.throw();

      // positions:
      expect(result.syntax[0]).to.have.property('position').that.eqls({ offset: 13, line: 2, character: 0 });
      expect(result.syntax[0]).to.have.deep.property('value.0.position').that.eqls({ offset: 21, line: 2, character: 8 });
      expect(result.syntax[0]).to.have.deep.property('value.1.position').that.eqls({ offset: 27, line: 2, character: 14 });
      expect(result.syntax[0]).to.have.deep.property('value.2.position').that.eqls({ offset: 50, line: 3, character: 6 });
      expect(result.syntax[1]).to.have.property('position').that.eqls({ offset: 55, line: 4, character: 0 });
      expect(result.syntax[1]).to.have.deep.property('value.0.position').that.eqls({ offset: 59, line: 4, character: 4 });
      expect(result.syntax[1]).to.have.deep.property('value.0.value.position').that.eqls({ offset: 59, line: 4, character: 4 });
      expect(result.syntax[1]).to.have.deep.property('value.0.value.value.0.position').that.eqls({ offset: 61, line: 4, character: 6 });
      expect(result.syntax[1]).to.have.deep.property('value.0.value.value.1.position').that.eqls({ offset: 64, line: 4, character: 9 });

      // names
      expect(result.syntax[0].name).to.eql('abc');
      expect(result.syntax[1].name).to.eql('b');

      // kinds
      expect(result.syntax[0]).to.have.property('kind').that.eqls('syntax_rule');
      expect(result.syntax[0]).to.have.deep.property('value.0.kind').that.eqls('terminal_string');
      expect(result.syntax[0]).to.have.deep.property('value.1.kind').that.eqls('terminal_string');
      expect(result.syntax[0]).to.have.deep.property('value.2.kind').that.eqls('terminal_string');
      expect(result.syntax[1]).to.have.property('kind').that.eqls('syntax_rule');
      expect(result.syntax[1]).to.have.deep.property('value.0.kind').that.eqls('syntactic_term');
      expect(result.syntax[1]).to.have.deep.property('value.0.value.kind').that.eqls('grouped_sequence');
      expect(result.syntax[1]).to.have.deep.property('value.0.value.value.0.kind').that.eqls('meta_identifier');
      expect(result.syntax[1]).to.have.deep.property('value.0.value.value.1.kind').that.eqls('terminal_string');

      // comments (don't care about positiions)
      expect(result.comments[0]).to.have.property('value', 'first');
      expect(result.comments[1]).to.have.property('value', 'second');
      expect(result.comments[2]).to.have.property('value', 'third');
    });
  });
});