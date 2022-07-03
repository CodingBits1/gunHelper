"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = useGunValue;

require("core-js/modules/web.dom-collections.iterator.js");

var _react = _interopRequireWildcard(require("react"));

var _gunHelper = _interopRequireDefault(require("../gunHelper"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function useGunValue(path, defaultValue) {
  const [value, setValue] = (0, _react.useState)(undefined);
  let loaded = (0, _react.useRef)(false);
  const setGunValue = (0, _react.useCallback)(val => {
    _gunHelper.default.put(path, val);
  }, [path]);
  (0, _react.useEffect)(() => {
    let listener = val => {
      loaded.current = true;
      setValue(val);
    };

    _gunHelper.default.on(path, listener);

    return () => _gunHelper.default.off(path, listener);
  }, [path]);

  if (loaded.current && value == undefined && defaultValue != undefined) {
    setValue(defaultValue);
    setGunValue(defaultValue);
  }

  return [value, setGunValue];
}