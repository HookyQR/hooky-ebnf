'use strict';
/*
  Take the AST from the EBNF parser and create a parser for the expressed language.

  The EBNF parser collects the following:

  terminal_string
  meta_identifier
  special_sequence
  syntax_rule
  single_definition
  syntax_term
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
  'syntax_term',
  'syntactic_factor',
  'optional_sequence',
  'repeated_sequence',
  'grouped_sequence'
];

class ParserBuilder {
  constructor(syntax, options) {
    this.syntax = syntax;
    this.seen = new Set();
    this.special = [];
    this.parseSyntax(syntax);
    this.expose = [];
    if (options.unexposed) {
      this.expose = this.seen.filter(element => options.unexposed.includes(element));
    }
    // make sure we have the methods needed
    if (this.special.length) {
      if (!options.special || options.special.length <= this.special.length)
        throw new Error(`Not enough special elements to cover those found in the syntax: '${this.special.join(', ')}'`);
      this.special.forEach(name => {
        if (!options.special.includes(name))
          throw new Error(`No special element method provided for '${name}'`);
        if (!(typeof options.special[name] === 'function'))
          throw new Error(`Special element provided for '${name}' is not a function`);
      });
    }
    this.special = options.special;
    this.build();
  }
  parseSyntax(syntax) {
    if (Array.isArray(syntax)) {
      return syntax.forEach(element => this.parseSyntax(element));
    }
    let k = syntax.kind;
    let n = syntax.name;
    let v = syntax.value;
    if (!k) return;
    if (!validKind.includes(k)) throw new Error(`Invalid kind seen: "${k}"`);
    if (k === 'syntax_rule') {
      if (!n) throw new Error(`Syntax rules must have a name.`);
      this.seen.add(n);
    }
    if (k === 'special_sequence') return this.special.add(v);
    if (!v || typeof v === 'string' || v instanceof Buffer) return;
    this.parseSyntax(v);
  }
  build() {
    
  }
}