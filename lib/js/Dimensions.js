define(function(){
  'use strict';
  var
    widthProp = Symbol('width'),
    heightProp = Symbol('height')
  ;
  class Dimensions{
    constructor(width, height){
      if(typeof(width) !== 'number' || typeof(height) !== 'number'){
        throw new Error('Width & Height must be numbers!');
      }
      this[widthProp] = width;
      this[heightProp] = height;
    }
    get width(){
      return this[widthProp];
    }
    get height(){
      return this[heightProp];
    }
  }

  return Dimensions;
});
