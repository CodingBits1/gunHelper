import GUN from "gun/gun.js"
import SEA from "gun/sea"
import "gun/lib/yson.js";
import "gun/lib/dom.js"
import "gun/lib/upload.js"
import "gun/lib/load.js";
import "gun/lib/radix"
import "gun/lib/radisk"
import "gun/lib/store"
import "gun/lib/rindexed"

import {getRulesForPath, decryptByRule, encryptByRule} from "./gunRulesHelper.js"
require('gun/lib/unset.js')
// let knownGunServer = ["http://localhost:1337/gun", "https://gun-manhattan.herokuapp.com/gun"]
// let knownGunServer = ["https://gun-manhattan.herokuapp.com/gun"]

export const gun = GUN({
  peers: ["/gun", "https://gun-manhattan.herokuapp.com/gun"]
});

const gunHelper = (function() {
  let APP_KEY = ""
  const listenerMap = new Map();
  const changeOnlyListenerMap = new Map();

  let rules = {};

  return { // public interface
    gun,
    get listenerMap(){ return {changeOnlyListenerMap, listenerMap} },
    get appKey(){
      return APP_KEY;
    },
    set appKey(key){
      if(!APP_KEY) APP_KEY = key
      else throw new Error("[GUN_HELPER] appKey can only be set once")
    },
    set rules(newRules){
      rules = newRules
    },
    get rules(){
      return rules;
    },
    changePeers: (peers) => {
      gun.opt({peers: Array.isArray(peers) ? peers : [peers]})
    },
    cleanPath: (path) => path[path.length-1] == "/" ? path.substr(0,path.length-1) : path,
    getNodeByPath: (path) => {
      let pathSplit = gunHelper.cleanPath(path).split("/").filter(s => !!s.length)
      let isUserRoot = pathSplit[0] == "_user";
      let isPublicRoot = pathSplit[0] == "_public";
      let hasRoot = ["_user","_public"].includes(pathSplit[0])

      let node = isUserRoot ?  gunHelper.userAppRoot() : isPublicRoot ? gunHelper.publicAppRoot() : gun;
      for (let index = hasRoot ? 1 : 0; index < pathSplit.length; index++) {
        if(pathSplit[index] == "_back") node = node.back();
        else node = node.get(pathSplit[index]) 
      }
      return node;
    },
    on: function (path, listener, changeOnly) {
      let cleanPath = gunHelper.cleanPath(path)
      let map = !changeOnly ? listenerMap : changeOnlyListenerMap;
      //Get Current Listeners for path
      let listeners = map.get(cleanPath) || []
      let isNewPath = !listeners.length;
      //Add New Listener
      map.set(cleanPath, [...listeners, listener])

      gunHelper.onceAsync(cleanPath).then(val => {
        listener(val)
      })

      
      if(isNewPath){
        let rule = getRulesForPath(cleanPath)
        gunHelper.getNodeByPath(cleanPath).on((value, key, _msg, _ev) => {
          decryptByRule(rule, value).then((val) => {
            listenerMap.get(cleanPath).forEach(l => l(val, key, _msg, _ev))
          })
        }, changeOnly ? {change: changeOnly} : undefined)
      }
    },
    onceAsync: (keyPath, maxRequestTime = 5000) => new Promise(res => {
      let path  = gunHelper.cleanPath(keyPath);
      let node = gunHelper.getNodeByPath(path)

      let loaded = false;
      let cancleInterval = setInterval(() => {
        clearInterval(cancleInterval)
        if(!loaded) return;
        res({err:`Could not fetch ${path}(0)`, errData:[path]})
      }, maxRequestTime)
      node.once(( data, key, _msg, _ev ) => {
        if(cancleInterval) clearInterval(cancleInterval);
        let rule = getRulesForPath(path);
        decryptByRule(rule, data).then(res)
      })
    }),
    off: (path, listener) => {
      let cleanPath = gunHelper.cleanPath(path)
      //Get Current Listeners for path
      let listeners = listenerMap.get(cleanPath) || []
      let changeOnlyListeners = changeOnlyListenerMap.get(cleanPath) || []
      if(!listeners.length && !changeOnlyListeners.length) return;

      let newList = listeners.filter((l) => l != listener)
      let newListChange = changeOnlyListeners.filter((l) => l != listener)

      listenerMap.set(cleanPath, newList)
      changeOnlyListenerMap.set(cleanPath, newListChange)

      let isLastListener = !newList.length;
      let isLastListenerChange = !newListChange.length;

      //TODO Probably better to add _ev to the map and remove the listeners individually if possible
      if(isLastListener && isLastListenerChange) gunHelper.getNodeByPath(cleanPath).off(); 
    },
    put: async (path, data, keyPair) => {
      let cleanPath = gunHelper.cleanPath(path);
      let rule = getRulesForPath(cleanPath);
      let preparedData = await encryptByRule(rule, data, keyPair);
      gunHelper.getNodeByPath(cleanPath).put(preparedData);
    },
    publicAppRoot: () => {
      if (!APP_KEY) throw new Error("[GUN_HELPER] App key is not set yet. Run gunHelper.appKey = KEY first.")
      return gun.get(APP_KEY)
    },
    userAppRoot: () => {
      if (!APP_KEY) throw new Error("[GUN_HELPER] App key is not set yet. Run gunHelper.appKey = KEY first.")
      return gun.user().get(APP_KEY)
    },

    encryptUser: async (data) => {
      let keyPair = gun.user()._.sea
      return await SEA.encrypt(data, keyPair)
    },
    decryptUser: async (data) => {
      let keyPair = gun.user()._.sea
      if(!( data + "" ).startsWith("SEA")) return data
      return await SEA.decrypt(data, keyPair)
    },

    trashNode: (node) => new Promise(res => {
      gun.user().get("trash").set(node)
      node.put(null)
    }),
    getUserKey: async (alias) => {
      if (!alias) return {err: "no alias set"};
      let userKeyData = {...(await gunHelper.onceAsync(`~@${alias}`) || {})}
      delete userKeyData["_"];
      let key = ( Object.keys(userKeyData) )[0]
      if (!key) return {err: "user does not exist"};
      return key;
    },
    load: async (path, cb, opt) => {
      let loadingSet = new Set();
      let loadedMap = new Map();
      let load = async (path) => {
        let data = await gunHelper.onceAsync(path)
        if(data?.["_"]) delete data["_"];
        let isObj = !!data && typeof data === 'object' &&  !Array.isArray(data)
        if(!isObj) return data;
        await Promise.all(Object.entries(data).map(([key, val]) => {
          return new Promise(async ( res, rej ) => {
            if(!opt?.keepNull && val == null) {
              delete data[key];
              return res();
            }
            let nodeKey = val?.["#"]
            if (nodeKey && !loadingSet.has(nodeKey)){
              loadingSet.add(nodeKey);
              loadedMap.set(nodeKey, await load(nodeKey))
              data[key] = loadedMap.get(nodeKey);
            }
            res();
          })
        }))
        return data;
      }
      let data =  await load(path)
      if(!data) return data;
      let decryptedData = await new Promise((res, rej) => {
        let isObj = !!data && typeof data === 'object' &&  !Array.isArray(data)
        let rule = getRulesForPath(path);
        let dataObj = isObj ? { ...data }: data
        let dataObjCopy = isObj ? { ...data }: data

        decryptByRule(rule, dataObj, path, dataObjCopy).then(result => {
          cb && cb(result)
          res(result)
        })
      })
      return decryptedData;
    }
  };
})();

export default gunHelper

window.gun = gun;
window.gunHelper = gunHelper;