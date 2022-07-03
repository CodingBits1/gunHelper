"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.decryptByRule = decryptByRule;
exports.encryptByRule = encryptByRule;
exports.getRulesForPath = getRulesForPath;

require("core-js/modules/es.regexp.exec.js");

require("core-js/modules/es.string.split.js");

require("core-js/modules/web.dom-collections.iterator.js");

require("core-js/modules/es.string.starts-with.js");

require("core-js/modules/es.string.replace.js");

require("core-js/modules/es.array.includes.js");

require("core-js/modules/es.string.includes.js");

require("core-js/modules/esnext.string.replace-all.js");

require("core-js/modules/es.promise.js");

var _gun = require("gun");

var _gunHelper = _interopRequireDefault(require("./gunHelper"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function getRulesForPath(path) {
  let rules = _gunHelper.default.rules;
  let rulesPart = rules;
  let pathSplit = path.split("/").filter(Boolean);
  let wildCards = new Map();

  for (let i = 0; i < pathSplit.length; i++) {
    if (!rulesPart) break;
    let rule = rulesPart[pathSplit[i]];

    if (rule) {
      rulesPart = _objectSpread({}, rule);
      continue;
    }

    let restRules = Object.entries(rulesPart).filter(_ref => {
      let [key, val] = _ref;
      return key.startsWith("$");
    });
    if (restRules.length > 1) throw new Error("[GUN-HELPER] The rule \"".concat(pathSplit[i - 1] || "ROOT", "\" has more than one wildcard."));

    if (!restRules.length) {
      rulesPart = null;
      continue;
    }

    wildCards.set(restRules[0][0].replace("$", ""), pathSplit[i]);
    rulesPart = restRules[0][1];
  }

  let returnRules = {};
  Object.entries(rulesPart || {}).forEach(_ref2 => {
    let [key, val] = _ref2;

    if (typeof val === 'string' || val instanceof String) {
      let returnString = val;
      wildCards.forEach((sub, id) => {
        if (returnString.includes("{".concat(id, "}"))) returnString = returnString.replaceAll("{".concat(id, "}"), sub);
      });
      returnRules[key] = returnString;
    } else {
      returnRules[key] = val;
    }

    return undefined;
  });
  returnRules.path = path;
  return returnRules;
}

async function decryptByRule(rule, data, parentPath, parentData) {
  if (rule.type == "encUser") {
    return await _gunHelper.default.decryptUser(data);
  } else if (rule.type == "enc") {
    let key = null;
    let keyPath = rule.keyPair || rule.key;

    if (parentPath && parentData && keyPath.startsWith(parentPath)) {
      //See if key exists in parent
      let cleanParentPath = parentPath[parentPath.length - 1] == "/" ? parentPath.substr(0, parentPath.length - 1) : parentPath;
      let path = keyPath.replace(cleanParentPath + "/", "");
      if (path.startsWith("/")) path = path.substring(1);
      let split = path.split("/").filter(Boolean);

      let updateKeyData = () => {};

      let keyData = parentData;
      let keyDataFound = !split.some(k => {
        if (keyData[k]) {
          var _keyData;

          let preData = keyData;

          updateKeyData = val => preData[k] = val;

          keyData = (_keyData = keyData) === null || _keyData === void 0 ? void 0 : _keyData[k];
          return false;
        } else return true;
      });

      if (keyDataFound && keyData) {
        var _keyData2, _keyData2$startsWith;

        if ((_keyData2 = keyData) !== null && _keyData2 !== void 0 && (_keyData2$startsWith = _keyData2.startsWith) !== null && _keyData2$startsWith !== void 0 && _keyData2$startsWith.call(_keyData2, "SEA")) {
          let rule = getRulesForPath(cleanParentPath + "/" + path);
          keyData = await decryptByRule(rule, keyData, parentPath, parentData);
          updateKeyData(keyData);
        }
      }

      key = keyData || (await _gunHelper.default.onceAsync(keyPath));
    } else {
      key = await _gunHelper.default.onceAsync(keyPath);
    }

    return await _gun.SEA.decrypt(data, key);
  }

  let dataIsObject = typeof data === 'object' && data !== null;

  if (dataIsObject && parentData && parentPath) {
    let entries = !Array.isArray(data) ? Object.entries(data || {}) : data;
    let dataCopy = {};
    let dataPromises = [];

    for (let i = 0; i < entries.length; i++) {
      let key = entries[i][0];
      let value = entries[i][1];
      let keyPath = "".concat(rule.path, "/").concat(key);
      let isObj = typeof value === 'object' && value !== null && !Array.isArray(value);
      let subRule = getRulesForPath(keyPath);
      dataPromises.push(new Promise(async res => {
        dataCopy[key] = await decryptByRule(subRule, isObj ? _objectSpread({}, value) : value, parentPath, parentData, keyPath);
        res();
      }));
    }

    await Promise.all(dataPromises);
    let isObj;
    return !!data ? _objectSpread({}, dataCopy) : data;
  }

  return dataIsObject ? _objectSpread({}, data) : data;
}

async function encryptByRule(rule, data, keyPair) {
  if (data == null) return data;
  let prepedData = data;

  if (rule.type == "encUser") {
    prepedData = await _gunHelper.default.encryptUser(data);
  } else if (rule.type == "enc") {
    let key = null;
    let keyPath = rule.keyPair || rule.key;
    key = keyPair || (await _gunHelper.default.onceAsync(keyPath));
    if (!key && !keyPair) throw new Error("[EncryptByRule] Encryption key(".concat(keyPath, ") not found. Data at path: \"").concat(rule.path, "\" could not be encrypted"));else prepedData = await _gun.SEA.encrypt(data, key);
  }

  return prepedData;
}