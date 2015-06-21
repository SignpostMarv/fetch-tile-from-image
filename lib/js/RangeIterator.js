define(function(){
  'use strict';
  var RangeIterator = class RangeIterator {
    constructor(start, stop) {
      this.value = start;
      this.stop = stop;
    }

    next() {
      var value = this.value;
      if (value < this.stop) {
        this.value++;
        return {done: false, value: value};
      } else {
        return {done: true, value: undefined};
      }
    }

    static range(start, stop){
      return new RangeIterator(start, stop);
    }
  };
  RangeIterator.prototype[Symbol.iterator] = function(){
    return this;
  };
  return RangeIterator;
});
