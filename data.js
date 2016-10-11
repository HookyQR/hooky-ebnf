'use strict';
class Data {
  constructor(data) {
    if ( data instanceof Buffer) this.data = data;
    else if ( typeof data === 'string') this.data = Buffer.from(data);
    else throw new TypeError('data must be a Buffer or string');
    this._offset = 0;
    this._line = 0;
    this._lineOffset = 0;
  }
  slice(start, stop){
    return this.data.slice(start,stop);
  }
  complete() {
    return this._offset >= this.data.length;
  }
  get offset() {
    return this._offset;
  }
  get position() {
    return {
      offset: this._offset,
      line: this._line,
      character: this._offset - this._lineOffset
    };
  }
  get peek() {
    return this.data[this._offset + 1];
  }
  get step() {
    this._offset++;
    return this;
  }
  get current() {
    return this.data[this._offset];
  }
  addLine() {
    this._line++;
    this._offset++;
    this._lineOffset = this._offset;
  }
  returnTo(pos) {
    this._offset = pos.offset;
    this._line = pos._line;
    this._lineOffset = pos.offset - pos.character;
  }
}

module.exports = Data;