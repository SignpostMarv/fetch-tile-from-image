define(function(require){
  'use strict';
  var
    props = {},
    hasFetch = typeof(fetch) === 'function',
    nearestPow2 = function(length){
      return Math.pow(2, Math.round(Math.log(length) / Math.log(2)));
    }
  ;
  for(var prop of [
    'fetched',
    'imageSource',
    'imageBlob',
    'imageBuffer',
    'img',
    'dimensions',
    'options',
    'hash',
    'decodedHash',
    'siloHash2decodedHash',
    'tileCache',
    'fetchMethod',
    'resizeCache'
  ]){
    props[prop] = Symbol(prop);
  }
  class FetchTileFromImage{
    constructor(imageSource, options){
      if(
        typeof(options) !== 'object'
      ){
        throw new Error('options not specified!');
      }else if(
        !options.hasOwnProperty('hash') ||
        typeof(options.hash) !== 'function'
      ){
        throw new Error('Hash function not specified.');
      }else if(
        !options.hasOwnProperty('Silo') ||
        typeof(options.Silo) !== 'object'
      ){
        throw new Error('Silo not supplied!');
      }
      for(var prop in props){
        this[prop] = null;
      }
      this[props.fetched] = false;
      this[props.imageSource] = imageSource;
      this[props.options] = options;
      this[props.siloHash2decodedHash] = options.Silo.Silo('hash2decodedHash');
      this[props.tileCache] = options.Silo.Silo('tileCache');
      this[props.resizeCache] = options.Silo.Silo('resizeCache');
    }
    Resize(width, height){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(
          typeof(width) !== 'number' ||
          typeof(height) !== 'number'
        ){
          throw new Error('width and height must be numbers.');
        }else if(
          width <= 0 ||
          height <= 0
        ){
          throw new Error('width and height must be greater than zero');
        }

        self.DecodedHash().then(function(hash){
          var
            silo = self[props.resizeCache].Silo(hash).Silo(width),
            resolveFromBlob = function(blob){
              resolve(new FetchTileFromImage(
                blob,
                {
                  hash: self[props.options].hash,
                  Silo: silo.Silo(height)
                }
              ));
            }
          ;
          silo.getItem(height).then(function(blob){
            if(blob){
              console.log('fetching from cache');
              resolveFromBlob(blob);
            }else{
              console.warn('generating');
              self.Image().then(function(img){
                var
                  canvas = document.createElement('canvas'),
                  ctx = canvas.getContext('2d')
                ;
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img,
                  0, 0,
                    img.width,
                    img.height,
                  0, 0,
                    width,
                    height
                );
                canvas.toBlob(function(blob){
                  silo.setItem(height, blob).then(function(){
                    resolveFromBlob(blob);
                  }, reject);
                });
              }, reject);
            }
          }, reject);
        }, reject);
      });
    }
    ResizePow2(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        self.Dimensions().then(function(dim){
          self.Resize(
            nearestPow2(dim.width),
            nearestPow2(dim.height)
          ).then(resolve, reject);
        }, reject);
      });
    }
    MipMap(level){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(typeof(level) !== 'number'){
          throw new Error('level not specified as number!');
        }
        self.MipMapAtlas().then(function(atlas){
          var
            width = atlas.width,
            height = atlas.height,
            sourceWidth = (width / 3) * 2,
            sourceHeight = height,
            levels = [0, 0, sourceWidth, sourceHeight],
            checkWidth = sourceWidth / 2,
            checkHeight = sourceHeight / 2,
            checkDim = Math.min(checkWidth, checkHeight),
            offsetY = 0,
            canvas,
            ctx
          ;
          while(checkDim >= 1){
            levels.push(
              sourceWidth,
              offsetY,
              checkWidth,
              checkHeight
            );
            offsetY += checkHeight;
            checkWidth /= 2;
            checkHeight /= 2;
            checkDim = Math.min(checkWidth, checkHeight);
          }
          console.log(levels);
          if((level * 4) >= levels.length){
            reject('outside range!');
          }else{
            canvas = document.createElement('canvas');
            canvas.width = levels[(level * 4) + 2];
            canvas.height = levels[(level * 4) + 3];
            ctx = canvas.getContext('2d');
            ctx.putImageData(atlas.getContext('2d').getImageData(
              levels[(level * 4) + 0],
              levels[(level * 4) + 1],
              levels[(level * 4) + 2],
              levels[(level * 4) + 3]
            ), 0, 0);
            resolve(canvas);
          }
        }, reject);
      });
    }
    MipMapAtlas(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        self[props.options].Silo.getItem('MipMapAtlas').then(
          function(atlasBlob){
            if(atlasBlob){
              console.log('fetching MipMapAtlas from cache');
              var
                canvas = document.createElement('canvas'),
                ctx = canvas.getContext('2d'),
                img = new Image()
              ;
              img.onload = function(){
                canvas.width = this.width;
                canvas.height = this.height;
                ctx.drawImage(this, 0, 0);
                URL.revokeObjectURL(this.src);
                resolve(canvas);
              };
              img.onerror = function(e){
                reject(e);
              };
              img.src = URL.createObjectURL(atlasBlob);
            }else{
              var
                callWhenDone = function(atlasSource){
                  console.warn('generating MipMapAtlas');
                  atlasSource.Dimensions().then(function(dim){
                    atlasSource.Image().then(function(img){
                      var
                        canvas = document.createElement('canvas'),
                        ctx = canvas.getContext('2d'),
                        newWidth = dim.width * 1.5,
                        newHeight = dim.height,
                        offsetX = dim.width,
                        offsetY = 0,
                        levelPromises = [],
                        checkWidth = dim.width / 2,
                        checkHeight = dim.height / 2,
                        checkDim = Math.min(checkWidth, checkHeight),
                        makePromise = function(newW, newH, drawOffset){
                          return new Promise(function(res, rej){
                            atlasSource.Resize(newW, newH).then(
                              function(newImg){
                                newImg.Image().then(function(newImgEl){
                                  ctx.drawImage(newImgEl, offsetX, drawOffset);
                                  res();
                                }, rej);
                              },
                              rej
                            );
                          });
                        },
                        levelCrawler = function(){
                          var
                            currentPromise = levelPromises.shift()
                          ;
                          if(currentPromise){
                            currentPromise.then(levelCrawler, reject);
                          }else{
                            canvas.toBlob(function(blob){
                              self[props.options].Silo.setItem(
                                'MipMapAtlas',
                                blob
                              ).then(function(){
                                resolve(canvas);
                              }, reject);
                            });
                          }
                        }
                      ;
                      canvas.width = newWidth;
                      canvas.height = newHeight;
                      ctx.drawImage(img, 0, 0);
                      while(checkDim >= 1){
                        levelPromises.push(makePromise(checkWidth, checkHeight, offsetY));
                        offsetY += checkHeight;
                        checkWidth /= 2;
                        checkHeight /= 2;
                        checkDim = Math.min(checkWidth, checkHeight);
                      }
                      levelCrawler();
                    }, reject);
                  }, reject);
                }
              ;
              self.Dimensions().then(function(dim){
                if(
                  dim.width !== nearestPow2(dim.width) ||
                  dim.height !== nearestPow2(dim.height)
                ){
                  self.ResizePow2().then(function(pow2){
                    callWhenDone(pow2);
                  }, reject);
                }else{
                  callWhenDone(self);
                }
              }, reject);
            }
          },
          reject
        );
      });
    }
    Blob(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(self[props.imageBlob]){
          resolve(self[props.imageBlob]);
        }else if(self[props.imageSource] instanceof Blob){
          resolve(self[props.imageSource]);
        }else{
          self[props.fetchMethod]().then(function(response){
            response.blob().then(function(blob){
              self[props.imageBlob] = blob;
              resolve(blob);
            });
          }, reject);
        }
      });
    }
    ArrayBuffer(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(self[props.imageBuffer]){
          resolve(self[props.imageBuffer]);
        }else if(self[props.imageSource] instanceof Blob){
          var
            reader = new FileReader()
          ;
          reader.addEventListener('loadend', function(){
            self[props.imageBuffer] = reader.result;
            resolve(self[props.imageBuffer]);
          });
          reader.readAsArrayBuffer(self[props.imageSource]);
        }else{
          self[props.fetchMethod]().then(function(response){
            response.arrayBuffer().then(function(buffer){
              self[props.imageBuffer] = buffer;
              resolve(buffer);
            });
          }, reject);
        }
      });
    }
    Image(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(!self[props.imageBlob]){
          self.Blob().then(
            function(blob){
              try{
                var
                  img = new Image(),
                  url = URL.createObjectURL(blob)
                ;
                img.onload = function(){
                  URL.revokeObjectURL(url);
                  self[props.img] = img;
                  resolve(self[props.img]);
                };
                img.onerror = function(e){
                  URL.revokeObjectURL(url);
                  reject(e);
                };
                img.src = url;
              }catch(e){
                reject(e);
              }
            },
            function(failure){
              reject(failure);
            }
          );
        }else{
          resolve(self[props.img]);
        }
      });
    }
    Canvas(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        self.Dimensions().then(function(dim){
          var
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d')
          ;
          canvas.width = dim.width;
          canvas.height = dim.height;
          self.Image().then(function(img){
            ctx.drawImage(img, 0, 0);
            resolve(canvas);
          });
        }, reject);
      });
    }
    Dimensions(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(!self[props.dimensions]){
          self.Image().then(
            function(img){
              require([
                './Dimensions.js'
              ], function(Dimensions){
                self[props.dimensions] = new Dimensions(img.width, img.height);
                resolve(self[props.dimensions]);
              });
            },
            function(failure){
              reject(failure);
            }
          );
        }else{
          resolve(self[props.dimensions]);
        }
      });
    }
    tileBlob(x, y, width, height, zoom){
      var
        self = this
      ;
      zoom = typeof(zoom) !== 'number' ? 0 : zoom;
      return new Promise(function(resolve, reject){
        if(
          typeof(x) !== 'number' ||
          typeof(y) !== 'number' ||
          typeof(width) !== 'number' ||
          typeof(height) !== 'number'
        ){
          throw new Error('all arguments must be numbers');
        }else if(
          x < 0 ||
          y < 0
        ){
          throw new Error(
            'X & Y offsets must be greater than or equal to zero'
          );
        }else if(
          width <= 0 ||
          height <= 0
        ){
          throw new Error('width & height must be positive numbers');
        }
        self.DecodedHash().then(function(hash){
          var
            silo = self[props.tileCache]
          ;
          for(var siloName of [
            'Blob',
            hash,
            height,
            width,
            y
          ]){
            silo = silo.Silo(siloName);
          }
          silo.getItem(x).then(function(tile){
            if(tile){
              console.log('fetching from cache');
              resolve(tile);
            }else{
              console.warn('generating');
              self.Dimensions().then(
                function(dim){
                  if(x > dim.width || y > dim.height){
                    throw new Error('out of bounds');
                  }else{
                    var
                      canvas = document.createElement('canvas'),
                      ctx = canvas.getContext('2d')
                    ;
                    canvas.width = width;
                    canvas.height = height;
                    ctx.fillStyle = 'rgba(0,0,0,0)';
                    ctx.fillRect(0, 0, width, height);
                    self.Image().then(
                      function(img){
                        ctx.drawImage(
                          img,
                          x,
                          y,
                          width,
                          height,
                          0,
                          0,
                          width,
                          height
                        );
                        canvas.toBlob(function(tile){
                          silo.setItem(x, tile).then(function(){
                            resolve(tile);
                          }, reject);
                        });
                      },
                      function(failure){
                        reject(failure);
                      }
                    );
                  }
                },
                function(failure){
                  reject(failure);
                }
              );
            }
          }, reject);
        }, reject);
      });
    }
    tile(x, y, width, height){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        self.tileBlob(x, y, width, height).then(function(blob){
          var
            tile = new Image(),
            url = URL.createObjectURL(blob)
          ;
          tile.onload = function(){
            URL.revokeObjectURL(url);
            resolve(tile);
          };
          tile.onerror = function(e){
            URL.revokeObjectURL(url);
            reject(e);
          };
          tile.src = url;
        }, reject);
      });
    }
    decode(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        self.Canvas().then(function(canvas){
          var
            ctx = canvas.getContext('2d')
          ;
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        }, reject);
      });
    }
    Hash(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(self[props.hash]){
          resolve(self[props.hash]);
        }else{
          self.ArrayBuffer().then(function(buffer){
            self[props.hash] = self[props.options].hash(buffer);
            resolve(self[props.hash]);
          }, reject);
        }
      });
    }
    DecodedHash(){
      var
        self = this
      ;
      return new Promise(function(resolve, reject){
        if(self[props.decodedHash]){
          resolve(self[props.decodedHash]);
        }else{
          self.Hash().then(function(hash){
            self[props.siloHash2decodedHash].getItem(hash).then(
              function(decodedHash){
                if(decodedHash){
                  self[props.decodedHash] = decodedHash;
                  resolve(decodedHash);
                }else{
                  self.decode().then(function(data){
                    self[props.decodedHash] =
                      self[props.options].hash(data.buffer)
                    ;
                    self[props.siloHash2decodedHash].setItem(
                      hash,
                      self[props.decodedHash]
                    ).then(function(){
                      resolve(self[props.decodedHash]);
                    }, reject);
                  }, reject);
                }
              },
              reject
            );
          }, reject);
        }
      });
    }
  }

  FetchTileFromImage.prototype[props.fetchMethod] = function(){
    var
      self = this
    ;
    return new Promise(function(resolve, reject){
      if(!hasFetch){
        reject('fetch api not available!');
      }else{
        fetch(self[props.imageSource]).then(function(response){
          resolve(response.clone());
        }, reject);
      }
    });
  };

  return FetchTileFromImage;
});
