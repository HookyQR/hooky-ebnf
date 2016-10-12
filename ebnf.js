'use strict';
const Data = require('./data');


function trim(dataBuffer) {
  let p = 0,
    c, start = 0;
  while ((c = dataBuffer[p]) && (0x20 === c || (0x0a <= c && 0x0d >= c))) {
    p++;
  }
  start = p;
  p = dataBuffer.length - 1;
  while ((p > start) && (c = dataBuffer[p]) && (0x20 === c || (0x0a <= c && 0x0d >= c))) {
    p--;
  }
  if (p < start) return Buffer.from([]);
  return dataBuffer.slice(start, p + 1);
}

let allVerticalsAsLines = false;

class EBNFSyntaxError extends Error {
  constructor(message, start, end) {
    super(`${message} at ${start.line}:${start.character}, ${end.line}:${end.character}`);
    this.start = start;
    this.end = end;
  }
}
// Part 2: removal of non-printable

class EBNF {
  constructor(buffer) {
    this.data = new Data(buffer);
    this.syntax = [];
    this.comments = [];
    this._syntax(this.data);
  }

  // first quote symbol, first terminal character, {first terminal character}, first quote symbol | second quote symbol, second terminal character, {second terminal character}, second quote symbol;
  _terminalString() {
    let c = this.data.current;
    const position = this.data.position,
      entry = c;
    if (entry !== 0x27 && entry !== 0x22) return;
    c = this.data.peek;
    if (c === entry) return; // TODO: error
    while ((c = this.data.step.current) && c !== entry && (0x20 <= c || 0x7e >= c)) {}
    if (c !== entry) return; // TODO: this is an error
    return {
      kind: 'terminal_string',
      length: this.data.step.offset - position.offset,
      value: this.data.slice(position.offset + 1, this.data.offset - 1),
      position
    };
  }

  // space character | horizontal tabulation character | new line | vertical tabulation character | form feed;
  // we collect these here, it's easier
  _collectWSAndComments(data) {
    let position = data.position;
    let c;
    while (!data.complete()) {
      //collect whitespace
      while ((c = data.current) && 0x20 === c || (0x09 <= c && 0x0d >= c)) {
        if (c === 0x0d) {
          if (data.peek === 0x0a) data.step;
          data.addLine();
        } else if (c === 0x0a) data.addLine();
        else if (allVerticalsAsLines && (c === 0x0b || c === 0x0c)) data.addLine();
        else data.step;
      }
      if (!this._bracketedTextualComment(data)) break;
    }
    c = data.offset - position.offset;
    if (c === 0) return; // none matched
    return true;
  }

  // Part 3: removal of textual comments
  _metaIdentifier(data) {
    let position, start, c;
    let final = [];
    this._collectWSAndComments(data);
    position = data.position;
    c = data.current;
    //first char must be a letter
    if ((0x41 > c || (0x5a < c && 0x61 > c) || 0x7a < c)) return;
    // while the current char is valid (this does a double check on the first char)
    while ((0x30 <= c && 0x39 >= c) || (0x41 <= c && 0x5a >= c) || (0x61 <= c && 0x7a >= c)) {
      start = data.offset;
      while ((c = data.step.current) &&
        ((0x30 <= c && 0x39 >= c) || (0x41 <= c && 0x5a >= c) || (0x61 <= c && 0x7a >= c))) {}
      // will always be at least one, because of the double while checks
      final.push(data.slice(start, data.offset));
      this._collectWSAndComments(data);
      c = data.current;
    }
    if (!final.length) return data.returnTo(position);
    return {
      kind: 'meta_identifier',
      length: data.offset - position.offset,
      value: Buffer.concat(final),
      position
    };
  }

  // special sequence symbol, {special sequence character}, special sequence symbol;
  _specialSequence(data) {
    let position = data.position,
      c = data.current;
    if (c !== 0x3f) return;
    while ((c = data.step.current) && c !== 0x3f);
    if (c !== 0x3f) throw new EBNFSyntaxError('Unterminated special sequence', position, data.position); // EOF error
    return {
      kind: 'special_sequence',
      length: data.step.offset - position.offset,
      value: trim(data.slice(position.offset + 1, data.offset - 1)).toString(),
      position
    };
  }

  _bracketedTextualComment(data) {
      let position = data.position,
        c = data.current,
        d = 1;
      if (c !== 0x28 || data.peek !== 0x2a) return;
      if (data.step.peek === 0x29) throw new EBNFSyntaxError('Invalid sequence of characters: "(*)"', position, data.position);
      while ((c = data.step.current) && d) {
        if (c === 0x2a && data.peek === 0x29) { // end
          data.step;
          d--;
        } else if (c === 0x28 && data.peek === 0x2a) { // start
          if (data.step.peek === 0x29) throw new EBNFSyntaxError('Invalid sequence of characters: "(*)"', position, data.position);
          d++;
        }
      }
      if (d) throw new EBNFSyntaxError('Incomplete comment', position, data.position);
      this.comments.push({
        value: trim(data.slice(position.offset + 2, data.offset - 2)).toString(),
        position
      });
    }
    // Part 4: EBNF structure

  _syntax(data) {
    this.syntax = [];
    this.comments = [];
    while (!data.complete()) {
      this._collectWSAndComments(data);
      if (!data.complete()) this.syntax.push(this._syntaxRule(data));
    }
  }

  _syntaxRule(data) {
    let position;
    this._collectWSAndComments(data);
    position = data.position;
    const metaId = this._metaIdentifier(data);
    if (!metaId) throw new EBNFSyntaxError('No Meta-identifier found', position, data.position);
    if (data.current != 0x3d) throw new EBNFSyntaxError(`No definition found for "${metaId.value.toString()}`, position, data.position);
    const definitions = this._definitionsList(data.step);
    // terminator symbol;
    if (data.current !== 0x3b) throw new EBNFSyntaxError(`No terminator for "${metaId.value.toString()}"`, position, data.position);
    return {
      kind: 'syntax_rule',
      name: metaId.value.toString(),
      value: definitions,
      length: data.step.offset - position.offset,
      position
    };
  }

  // single definition, { definition separator symbol, single definition };
  _definitionsList(data) {
    this._collectWSAndComments(data);
    const list = [];
    let definition;
    let c;
    while (!data.complete() && (definition = this._singleDefinition(data))) {
      list.push(definition);
      this._collectWSAndComments(data);
      c = data.current;
      if (c !== 0x7c && c !== 0x2f && c !== 0x21) break;
      this._collectWSAndComments(data.step);
    }
    return list;

  }

  // syntactic term, { concatenate symbol, syntactic term };
  _singleDefinition(data) {
      const list = [];
      let position = data.position;
      let term;
      while ((term = this._syntacticTerm(data))) {
        list.push(term);
        this._collectWSAndComments(data);
        if (data.current !== 0x2c) break;
        this._collectWSAndComments(data.step);
      }
      if (list.length === 0) return null;
      if (list.length === 1) return list[0];
      return {
        kind: 'single_definition',
        value: list,
        length: data.offset - position.offset,
        position
      };
    }
    // syntactic factor, [except symbol, syntactic exception];
  _syntacticTerm(data) {
      const position = data.position;
      const term = this._syntacticFactor(data);
      let except;
      if (!term) return;
      this._collectWSAndComments(data);
      if (data.current !== 0x2d) return term;
      this._collectWSAndComments(data.step);
      except = this._syntacticFactor(data); // must be non looping - can be empty
      return {
        kind: 'syntactic_term',
        value: term,
        except,
        length: data.offset - position.offset,
        position
      };
    }
    // [integer, repetition symbol], syntactic primary;
  _syntacticFactor(data) {
      const position = data.position;
      let c = data.current;
      let v = 0;
      while ((c = data.current) && 0x30 <= c && 0x39 >= c) {
        data.step;
        v *= 10;
        v += c - 0x30;
      }
      if (v) {
        this._collectWSAndComments(data);
        if (data.current !== 0x2a) return; //error
        this._collectWSAndComments(data.step);
      }
      c = this._syntacticPrimary(data);
      if (v && c) return {
        kind: 'syntactic_factor',
        count: v,
        value: c,
        length: data.offset - position.offset,
        position
      };
      else return c;
    }
    // optional sequence | repeated sequence | grouped sequence | meta identifier | terminal string | special sequence | empty sequence;
  _syntacticPrimary(data) {
      return this._optionalSequence(data) || this._repeatedSequence(data) || this._groupedSequence(data) || this._metaIdentifier(data) || this._terminalString(data) || this._specialSequence(data) || null;
      //null is the empty sequence
    }
    // start option symbol, definitions list, end option symbol;
  _optionalSequence(data) {
      let c = data.current;
      const position = data.position;
      let value;
      if (c === 0x5b);
      else if (c === 0x28 && data.peek === 0x2f) data.step;
      else return;
      value = this._definitionsList(data.step);
      c = data.current;
      if (c === 0x5d);
      else if (c === 0x2f && data.peek === 0x29) data.step;
      else {
        // unclosed option
        return;
      }
      return {
        kind: 'optional_sequence',
        value,
        length: data.step.offset - position.offset,
        position
      };
    }
    // start repeat symbol, definitions list, end repeat symbol;
  _repeatedSequence(data) {
      let c = data.current;
      const position = data.position;
      let value;
      if (c === 0x7b);
      else if (c === 0x28 && data.peek === 0x3a) data.step;
      else return;
      value = this._definitionsList(data.step);
      c = data.current;
      if (c === 0x7d);
      else if (c === 0x3a && data.peek === 0x29) data.step;
      else {
        // unclosed repeat
        return;
      }
      return {
        kind: 'repeated_sequence',
        value,
        length: data.step.offset - position.offset,
        position
      };
    }
    // start group symbol, definitions list, end group symbol;
  _groupedSequence(data) {
    const position = data.position;
    let value;
    if (data.current !== 0x28) return;
    value = this._definitionsList(data.step);
    if (data.current !== 0x29) {
      // unclosed group
      return;
    }
    return {
      kind: 'grouped_sequence',
      value,
      length: data.step.offset - position.offset,
      position
    };
  }
}

module.exports = EBNF;