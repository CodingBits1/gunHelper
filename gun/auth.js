import gunHelper, { gun } from "./gunHelper"
import SEA from "gun/sea"

const signInListener = new Set()

export function restoreSession(){
  return new Promise((resolve) => {
    if(gun.user().is) return resolve(true)
    //check if there is a session to restore
    if (window.sessionStorage.recall) {
      //we have a session to restore so lets restore it
      gun.user().recall({ sessionStorage: true }, function(res) {
        if (!res.err) { 
          notifySignInListener(true);
          resolve(true)
        }
        else resolve({err: res.err})
      })
    } else {
      //Rgere was no session to restore
      gun.user().recall({ sessionStorage: true });
      resolve(false)
    }
  })
}

export function canRecall(){
  const gun_auth = localStorage.getItem('gun_auth');
  return !!gun_auth;
}

export function recall(pin){
  return new Promise(async (resolve) => {
    const gun_auth = localStorage.getItem('gun_auth');
    if (!gun_auth) return;
    let auth = await SEA.decrypt(gun_auth, pin);
    if(!auth?.name || !auth?.pw) return resolve({err: "Pin Incorrect"})
    signIn(auth.name, auth.pw, false).then((result) => {
      //{err} || user
      resolve(result)
    })
  })
}

export async function signUp(name, pw, userName, pin){
  return new Promise(async (resolve) => {
    gun.user().create(name, pw, async ({ ok, pub, err }) => {
      if(err) return resolve({ err })
      if(ok == 0 && pub){
        let signInResult = await signIn(name, pw, pin)
        if(userName) await setUserName(userName);
        resolve(signInResult)
      } 
    })
  }); 
}

export async function setUserName(userName){
  await gunHelper.userAppRoot().get("name").put(userName);
}

export function signIn(name, pw, persist){
  return new Promise(async ( resolve ) => {
    await gun.user().auth(name, pw, async (user) => {
      if (user.err) return resolve(user)
      let onPersistError = (e) => {
        console.e("Could not persist user", e)
      };
      persistUser(name, pw, persist).then((persistResult) => {
        if(!persistResult && persist) onPersistError(persistResult)
        notifySignInListener(true);
        resolve(user)
      })
    });
  })
}

export function onSignedIn(cb){
  if(gun.user().is) cb(true)
  signInListener.add(cb);
}

function persistUser(name, pw, pin){
  return new Promise(async (resolve) => {
    let savedPin = await gunHelper.onceAsync("_user/auth_pin")
    if(savedPin) savedPin = await gunHelper.decryptUser(savedPin);

    let pinNumber = !isNaN(parseFloat(pin)) ? parseFloat(pin) : savedPin;
    if(!pinNumber) return resolve(true);
    if(!savedPin){
      await gunHelper.userAppRoot().get("auth_pin").put(await gunHelper.encryptUser(pinNumber));
    }
    let authData = await SEA.encrypt({name,pw: pw}, pinNumber)
    localStorage.setItem("gun_auth", authData);
    resolve(true);
  })
}

function notifySignInListener(signedIn){
  signInListener.forEach((cb) => cb(signedIn))
}



window.signUp = signUp