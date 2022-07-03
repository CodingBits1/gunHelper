"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = useGunAuth;

require("core-js/modules/web.dom-collections.iterator.js");

var _react = _interopRequireWildcard(require("react"));

var _gunHelper = _interopRequireWildcard(require("../gunHelper"));

var _auth = require("../auth");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function useGunAuth(persist, keepSession) {
  let [isSignedIn, setIsSignedIn] = (0, _react.useState)(false);
  let [error, setError] = (0, _react.useState)("");
  let [showPin, setShowPin] = (0, _react.useState)(false);
  let signUp = (0, _react.useCallback)((name, password, username, pin) => {
    if (isSignedIn) return _gunHelper.gun.user();
    (0, _auth.signUp)(name, password, username, !!persist && pin).then(result => {
      if (result.err) return setError(result.err);
      setError("");
      setIsSignedIn(true);
      setShowPin(false);
      return result;
    });
  }, [isSignedIn]);
  let signIn = (0, _react.useCallback)(function (name, password) {
    let persist = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    (0, _auth.signIn)(name, password, persist).then(result => {
      if (isSignedIn) return _gunHelper.gun.user();
      if (result.err) return setError(result.err);
      setError("");
      setIsSignedIn(true);
      setShowPin(false);
      return result;
    });
  }, [isSignedIn]);
  let recall = (0, _react.useCallback)(pin => {
    if (isSignedIn) return _gunHelper.gun.user();
    (0, _auth.recall)(pin).then(result => {
      if (result.err) return setError(result.err);
    });
  }, [isSignedIn]);
  let resetError = (0, _react.useCallback)(() => {
    setError("");
  }, [isSignedIn]);
  (0, _react.useEffect)(() => {
    (0, _auth.restoreSession)().then(result => {
      if (result === true) {
        return setIsSignedIn(true);
      }

      ;
      if (result !== false) console.warn("Problem in recall", result === null || result === void 0 ? void 0 : result.err);
      setShowPin((0, _auth.canRecall)());
      (0, _auth.onSignedIn)(signedIn => {
        setIsSignedIn(signedIn);
        setShowPin(false);
        setError("");
      });
    });
  }, []);
  return {
    showPin,
    isSignedIn,
    error,
    signIn,
    signUp,
    recall,
    resetError
  };
}