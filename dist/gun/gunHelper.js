"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.gun = exports.default = void 0;

require("core-js/modules/web.dom-collections.iterator.js");

require("core-js/modules/es.regexp.exec.js");

require("core-js/modules/es.string.split.js");

require("core-js/modules/es.array.includes.js");

require("core-js/modules/es.promise.js");

require("core-js/modules/es.string.starts-with.js");

var _gun = _interopRequireDefault(require("gun/gun.js"));

var _sea = _interopRequireDefault(require("gun/sea"));

require("gun/lib/yson.js");

require("gun/lib/dom.js");

require("gun/lib/upload.js");

require("gun/lib/load.js");

require("gun/lib/radix");

require("gun/lib/radisk");

require("gun/lib/store");

require("gun/lib/rindexed");

var _gunRulesHelper = require("./gunRulesHelper.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

require('gun/lib/unset.js'); // let knownGunServer = ["http://localhost:1337/gun", "https://gun-manhattan.herokuapp.com/gun"]
// let knownGunServer = ["https://gun-manhattan.herokuapp.com/gun"]


const gun = (0, _gun.default)({
  peers: ["/gun", "https://gun-manhattan.herokuapp.com/gun"]
});
exports.gun = gun;

const gunHelper = function () {
  let APP_KEY = "";
  const listenerMap = new Map();
  const changeOnlyListenerMap = new Map();
  let rules = {};
  return {
    // public interface
    gun,

    get listenerMap() {
      return {
        changeOnlyListenerMap,
        listenerMap
      };
    },

    get appKey() {
      return APP_KEY;
    },

    set appKey(key) {
      if (!APP_KEY) APP_KEY = key;else throw new Error("[GUN_HELPER] appKey can only be set once");
    },

    set rules(newRules) {
      rules = newRules;
    },

    get rules() {
      return rules;
    },

    changePeers: peers => {
      gun.opt({
        peers: Array.isArray(peers) ? peers : [peers]
      });
    },
    cleanPath: path => path[path.length - 1] == "/" ? path.substr(0, path.length - 1) : path,
    getNodeByPath: path => {
      let pathSplit = gunHelper.cleanPath(path).split("/").filter(s => !!s.length);
      let isUserRoot = pathSplit[0] == "_user";
      let isPublicRoot = pathSplit[0] == "_public";
      let hasRoot = ["_user", "_public"].includes(pathSplit[0]);
      let node = isUserRoot ? gunHelper.userAppRoot() : isPublicRoot ? gunHelper.publicAppRoot() : gun;

      for (let index = hasRoot ? 1 : 0; index < pathSplit.length; index++) {
        if (pathSplit[index] == "_back") node = node.back();else node = node.get(pathSplit[index]);
      }

      return node;
    },
    on: function on(path, listener, changeOnly) {
      let cleanPath = gunHelper.cleanPath(path);
      let map = !changeOnly ? listenerMap : changeOnlyListenerMap; //Get Current Listeners for path

      let listeners = map.get(cleanPath) || [];
      let isNewPath = !listeners.length; //Add New Listener

      map.set(cleanPath, [...listeners, listener]);
      gunHelper.onceAsync(cleanPath).then(val => {
        listener(val);
      });

      if (isNewPath) {
        let rule = (0, _gunRulesHelper.getRulesForPath)(cleanPath);
        gunHelper.getNodeByPath(cleanPath).on((value, key, _msg, _ev) => {
          (0, _gunRulesHelper.decryptByRule)(rule, value).then(val => {
            listenerMap.get(cleanPath).forEach(l => l(val, key, _msg, _ev));
          });
        }, changeOnly ? {
          change: changeOnly
        } : undefined);
      }
    },
    onceAsync: function onceAsync(keyPath) {
      let maxRequestTime = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 5000;
      return new Promise(res => {
        let path = gunHelper.cleanPath(keyPath);
        let node = gunHelper.getNodeByPath(path);
        let loaded = false;
        let cancleInterval = setInterval(() => {
          clearInterval(cancleInterval);
          if (!loaded) return;
          res({
            err: "Could not fetch ".concat(path, "(0)"),
            errData: [path]
          });
        }, maxRequestTime);
        node.once((data, key, _msg, _ev) => {
          if (cancleInterval) clearInterval(cancleInterval);
          let rule = (0, _gunRulesHelper.getRulesForPath)(path);
          (0, _gunRulesHelper.decryptByRule)(rule, data).then(res);
        });
      });
    },
    off: (path, listener) => {
      let cleanPath = gunHelper.cleanPath(path); //Get Current Listeners for path

      let listeners = listenerMap.get(cleanPath) || [];
      let changeOnlyListeners = changeOnlyListenerMap.get(cleanPath) || [];
      if (!listeners.length && !changeOnlyListeners.length) return;
      let newList = listeners.filter(l => l != listener);
      let newListChange = changeOnlyListeners.filter(l => l != listener);
      listenerMap.set(cleanPath, newList);
      changeOnlyListenerMap.set(cleanPath, newListChange);
      let isLastListener = !newList.length;
      let isLastListenerChange = !newListChange.length; //TODO Probably better to add _ev to the map and remove the listeners individually if possible

      if (isLastListener && isLastListenerChange) gunHelper.getNodeByPath(cleanPath).off();
    },
    put: async (path, data, keyPair) => {
      let cleanPath = gunHelper.cleanPath(path);
      let rule = (0, _gunRulesHelper.getRulesForPath)(cleanPath);
      let preparedData = await (0, _gunRulesHelper.encryptByRule)(rule, data, keyPair);
      gunHelper.getNodeByPath(cleanPath).put(preparedData);
    },
    publicAppRoot: () => {
      if (!APP_KEY) throw new Error("[GUN_HELPER] App key is not set yet. Run gunHelper.appKey = KEY first.");
      return gun.get(APP_KEY);
    },
    userAppRoot: () => {
      if (!APP_KEY) throw new Error("[GUN_HELPER] App key is not set yet. Run gunHelper.appKey = KEY first.");
      return gun.user().get(APP_KEY);
    },
    encryptUser: async data => {
      let keyPair = gun.user()._.sea;

      return await _sea.default.encrypt(data, keyPair);
    },
    decryptUser: async data => {
      let keyPair = gun.user()._.sea;

      if (!(data + "").startsWith("SEA")) return data;
      return await _sea.default.decrypt(data, keyPair);
    },
    trashNode: node => new Promise(res => {
      gun.user().get("trash").set(node);
      node.put(null);
    }),
    getUserKey: async alias => {
      if (!alias) return {
        err: "no alias set"
      };

      let userKeyData = _objectSpread({}, (await gunHelper.onceAsync("~@".concat(alias))) || {});

      delete userKeyData["_"];
      let key = Object.keys(userKeyData)[0];
      if (!key) return {
        err: "user does not exist"
      };
      return key;
    },
    load: async (path, cb, opt) => {
      let loadingSet = new Set();
      let loadedMap = new Map();

      let load = async path => {
        let data = await gunHelper.onceAsync(path);
        if (data !== null && data !== void 0 && data["_"]) delete data["_"];
        let isObj = !!data && typeof data === 'object' && !Array.isArray(data);
        if (!isObj) return data;
        await Promise.all(Object.entries(data).map(_ref => {
          let [key, val] = _ref;
          return new Promise(async (res, rej) => {
            if (!(opt !== null && opt !== void 0 && opt.keepNull) && val == null) {
              delete data[key];
              return res();
            }

            let nodeKey = val === null || val === void 0 ? void 0 : val["#"];

            if (nodeKey && !loadingSet.has(nodeKey)) {
              loadingSet.add(nodeKey);
              loadedMap.set(nodeKey, await load(nodeKey));
              data[key] = loadedMap.get(nodeKey);
            }

            res();
          });
        }));
        return data;
      };

      let data = await load(path);
      if (!data) return data;
      let decryptedData = await new Promise((res, rej) => {
        let isObj = !!data && typeof data === 'object' && !Array.isArray(data);
        let rule = (0, _gunRulesHelper.getRulesForPath)(path);
        let dataObj = isObj ? _objectSpread({}, data) : data;
        let dataObjCopy = isObj ? _objectSpread({}, data) : data;
        (0, _gunRulesHelper.decryptByRule)(rule, dataObj, path, dataObjCopy).then(result => {
          cb && cb(result);
          res(result);
        });
      });
      return decryptedData;
    }
  };
}();

var _default = gunHelper;
exports.default = _default;
window.gun = gun;
window.gunHelper = gunHelper;