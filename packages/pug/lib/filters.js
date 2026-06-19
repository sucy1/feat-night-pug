'use strict';

var filters = {};

exports.register = function(name, fn) {
  if (typeof name !== 'string' || !name.length) {
    throw new TypeError('Filter name must be a non-empty string.');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('Filter must be a function.');
  }
  filters[name] = fn;
};

exports.unregister = function(name) {
  delete filters[name];
};

exports.get = function(name) {
  return filters[name] || null;
};

exports.all = function() {
  var result = {};
  Object.keys(filters).forEach(function(key) {
    result[key] = filters[key];
  });
  return result;
};

exports.clear = function() {
  Object.keys(filters).forEach(function(key) {
    delete filters[key];
  });
};
