'use strict';
/*
  Take the AST from the EBNF parser and create a parser for the expressed language.

  The EBNF parser collects the following:

  terminal_string
  meta_identifier
  special_sequence
  syntax_rule
  single_definition
  syntactic_term
  syntactic_factor
  optional_sequence
  repeated_sequence
  grouped_sequence

  The constructor takes an option hash that contains EITHER exposed or unexposed to specify the meta_identifiers that should produce an AST element when the parser is run.

  For example: A parser for EBNF would only expose the identifiers listed above.

  The syntax passed in here WILL be mangled.
*/
const validKind = [
  'terminal_string',
  'meta_identifier',
  'special_sequence',
  'syntax_rule',
  'single_definition',
  'syntactic_term',
  'syntactic_factor',
  'optional_sequence',
  'repeated_sequence',
  'grouped_sequence'
];

class ParserBuilder {
  constructor(syntax, options) {
    options = options || {};
    this.syntax = syntax;
    this.seen = new Set();
    this.special = new Set();
    this._parseSyntax(syntax);
    this.expose = [];
    this.methods = {};
    if (options.unexposed) {
      this.expose = this.seen.filter(element => options.unexposed.includes(element));
    }
    // make sure we have the methods needed
    if (this.special.size) {
      if (!options.special || options.special.length < this.special.size)
        throw `Not enough special elements to cover those found in the syntax: (${this.special.size})
    ${Array.from(this.special).join('\n    ')}`;
      this.special.forEach(name => {
        if (!(name in options.special))
          throw `No special element method provided for '${name}'`;
        if (typeof options.special[name] !== 'function')
          throw `Special element provided for '${name}' is not a function`;
      });
    }
    this._special = options.special;
    this._build();
  }
  _parseSyntax(syntax) {
    if (Array.isArray(syntax)) {
      return syntax.forEach(element => this._parseSyntax(element));
    }
    let k = syntax.kind;
    let n = syntax.name;
    let v = syntax.value;
    if (!k) return;
    if (!validKind.includes(k)) throw `Invalid kind seen: "${k}"`;
    if (k === 'syntax_rule') {
      if (!n) throw `Syntax rules must have a name.`;
      this.seen.add(n);
    }
    if (k === 'special_sequence') return this.special.add(v);
    if (!v || typeof v === 'string' || v instanceof Buffer) return;
    this._parseSyntax(v);
  }
  _build() {
    //at the lowest, everything must be a 'syntax_rule'
    let a;
    let segments = {};
    for (a in this.syntax) {
      if (this.syntax[a].kind !== 'syntax_rule') throw "All base elements must be 'syntax_rule's.";
      if (1) return;
    }
  }
  _terminal_string_combine(element) {
    const first = element.values[0];
    if (element.values.all(r => r.value.length === 1)) {
      element.values = element.values.sort((a, b) => (a.value[0] - b.value[0]));
      element.test = `(${element.values.map(r=>r.test).join('||')})`;
      element.consume = 1;
    } else if (element.values.all(r => r.value.length === first.value.length)) {
      element.values = element.values.sort((a, b) => (a.value - b.value));

    }

  }
  _terminal_string(element) {
    if (element.value.length === 1) {
      element.test `c==${element.value[0]}`;
      element.consume = element.value.length;
    } else element.test = `d.equate(${element.value})`;
  }
  _single_definition() {}
  static ensureNoLoop(data, parser) {

  }
}

module.exports = ParserBuilder;