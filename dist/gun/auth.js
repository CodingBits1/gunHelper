"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.canRecall = canRecall;
exports.onSignedIn = onSignedIn;
exports.recall = recall;
exports.restoreSession = restoreSession;
exports.setUserName = setUserName;
exports.signIn = signIn;
exports.signUp = signUp;

require("core-js/modules/web.dom-collections.iterator.js");

require("core-js/modules/es.promise.js");

require("core-js/modules/es.parse-float.js");

var _gunHelper = _interopRequireWildcard(require("./gunHelper"));

var _sea = _interopRequireDefault(require("gun/sea"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const signInListener = new Set();

function restoreSession() {
  return new Promise(resolve => {
    if (_gunHelper.gun.user().is) return resolve(true); //check if there is a session to restore

    if (window.sessionStorage.recall) {
      //we have a session to restore so lets restore it
      _gunHelper.gun.user().recall({
        sessionStorage: true
      }, function (res) {
        if (!res.err) {
          notifySignInListener(true);
          resolve(true);
        } else resolve({
          err: res.err
        });
      });
    } else {
      //Rgere was no session to restore
      _gunHelper.gun.user().recall({
        sessionStorage: true
      });

      resolve(false);
    }
  });
}

function canRecall() {
  const gun_auth = localStorage.getItem('gun_auth');
  return !!gun_auth;
}

function recall(pin) {
  return new Promise(async resolve => {
    const gun_auth = localStorage.getItem('gun_auth');
    if (!gun_auth) return;
    let auth = await _sea.default.decrypt(gun_auth, pin);
    if (!(auth !== null && auth !== void 0 && auth.name) || !(auth !== null && auth !== void 0 && auth.pw)) return resolve({
      err: "Pin Incorrect"
    });
    signIn(auth.name, auth.pw, false).then(result => {
      //{err} || user
      resolve(result);
    });
  });
}

async function signUp(name, pw, userName, pin) {
  return new Promise(async resolve => {
    _gunHelper.gun.user().create(name, pw, async _ref => {
      let {
        ok,
        pub,
        err
      } = _ref;
      if (err) return resolve({
        err
      });

      if (ok == 0 && pub) {
        let signInResult = await signIn(name, pw, pin);
        if (userName) await setUserName(userName);
        resolve(signInResult);
      }
    });
  });
}

async function setUserName(userName) {
  await _gunHelper.default.userAppRoot().get("name").put(userName);
}

function signIn(name, pw, persist) {
  return new Promise(async resolve => {
    await _gunHelper.gun.user().auth(name, pw, async user => {
      if (user.err) return resolve(user);

      let onPersistError = e => {
        console.e("Could not persist user", e);
      };

      persistUser(name, pw, persist).then(persistResult => {
        if (!persistResult && persist) onPersistError(persistResult);
        notifySignInListener(true);
        resolve(user);
      });
    });
  });
}

function onSignedIn(cb) {
  if (_gunHelper.gun.user().is) cb(true);
  signInListener.add(cb);
}

function persistUser(name, pw, pin) {
  return new Promise(async resolve => {
    let savedPin = await _gunHelper.default.onceAsync("_user/auth_pin");
    if (savedPin) savedPin = await _gunHelper.default.decryptUser(savedPin);
    let pinNumber = !isNaN(parseFloat(pin)) ? parseFloat(pin) : savedPin;
    if (!pinNumber) return resolve(true);

    if (!savedPin) {
      await _gunHelper.default.userAppRoot().get("auth_pin").put(await _gunHelper.default.encryptUser(pinNumber));
    }

    let authData = await _sea.default.encrypt({
      name,
      pw: pw
    }, pinNumber);
    localStorage.setItem("gun_auth", authData);
    resolve(true);
  });
}

function notifySignInListener(signedIn) {
  signInListener.forEach(cb => cb(signedIn));
}

window.signUp = signUp;