"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {};
exports.default = void 0;

var _gunHelper = _interopRequireDefault(require("./gun/gunHelper"));

var _auth = require("./gun/auth");

Object.keys(_auth).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _auth[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _auth[key];
    }
  });
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = _gunHelper.default;
exports.default = _default;