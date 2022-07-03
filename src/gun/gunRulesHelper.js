import { SEA } from "gun";
import gunHelper from "./gunHelper";

export function getRulesForPath (path){
  let rules = gunHelper.rules;
  let rulesPart = rules;
  let pathSplit = path.split("/").filter(Boolean)
  let wildCards = new Map();
  for (let i = 0; i < pathSplit.length; i++) {
    if(!rulesPart) break;
    let rule = rulesPart[pathSplit[i]];
    if(rule){ 
      rulesPart = { ...rule };
      continue
    }
    let restRules = Object.entries(rulesPart).filter(([key, val]) => key.startsWith("$"))
    if(restRules.length > 1) throw new Error(`[GUN-HELPER] The rule "${pathSplit[i-1] || "ROOT"}" has more than one wildcard.`)
    if(!restRules.length){ 
      rulesPart = null; 
      continue;
    }
    wildCards.set(restRules[0][0].replace("$", ""),pathSplit[i])
    rulesPart = restRules[0][1];
  }
  
  let returnRules = {}
  Object.entries(rulesPart || {}).forEach(([key, val]) => {
    if(typeof val === 'string' || val instanceof String){
      let returnString =  val;
      wildCards.forEach(( sub, id ) => {
        if(returnString.includes(`{${id}}`)) returnString = returnString.replaceAll(`{${ id }}`, sub);
      })
      returnRules[key] = returnString;
    } else {
      returnRules[key] = val;
    }
    return undefined
  })
  returnRules.path = path;

  return returnRules; 
}

export async function decryptByRule(rule, data, parentPath, parentData){
  if(rule.type == "encUser"){
    return await gunHelper.decryptUser(data)
  } else if ( rule.type == "enc"){
    let key = null;
    let keyPath = rule.keyPair || rule.key;
    if(parentPath && parentData && keyPath.startsWith(parentPath)){
      //See if key exists in parent
      let cleanParentPath = parentPath[parentPath.length-1] == "/" ? parentPath.substr(0,parentPath.length-1) : parentPath

      let path = keyPath.replace(cleanParentPath + "/","");
      if (path.startsWith("/")) path = path.substring(1);
      let split = path.split("/").filter(Boolean);

      let updateKeyData = () => {}
      let keyData = parentData;
      let keyDataFound = !split.some((k) => {
        if(keyData[k]) {
          let preData = keyData;
          updateKeyData = (val) => preData[k] = val;
          keyData = keyData?.[k]
          return false
        }
        else return true;
      }) 
      if(keyDataFound && keyData){
        if(keyData?.startsWith?.("SEA")){
          let rule = getRulesForPath(cleanParentPath + "/" + path)
          keyData = await decryptByRule(rule, keyData, parentPath, parentData)
          updateKeyData(keyData)
        }
      }
      key = keyData || await gunHelper.onceAsync(keyPath);
    } else {
      key = await gunHelper.onceAsync(keyPath)
    }
    return await SEA.decrypt(data, key)
  }

  let dataIsObject = typeof data === 'object' && data !== null

  if(dataIsObject && parentData && parentPath){
    let entries = !Array.isArray(data) ? Object.entries(data || {}) : data;
    let dataCopy = {}
    let dataPromises = []
    for (let i = 0; i < entries.length; i++) {
      let key = entries[i][0]
      let value = entries[i][1]
      let keyPath = `${rule.path}/${key}`
      let isObj = typeof value === 'object' && value !== null && !Array.isArray(value)
      let subRule = getRulesForPath(keyPath)
        dataPromises.push(new Promise(async res => {
        dataCopy[key] = await decryptByRule(subRule, isObj ? { ...value }:value, parentPath, parentData, keyPath)
        res();
      }))
    }
    await Promise.all(dataPromises);
    let isObj
    return !!data ? { ...dataCopy } : data;
  } 

  return dataIsObject ? { ...data } : data;
}

export async function encryptByRule(rule, data, keyPair){
  if(data == null) return data;
  let prepedData = data;
  if(rule.type == "encUser"){
    prepedData = await gunHelper.encryptUser(data); 
  } else if ( rule.type == "enc"){
    let key = null;
    let keyPath = rule.keyPair || rule.key;
    key = keyPair || await gunHelper.onceAsync(keyPath)
    if(!key && !keyPair) throw new Error(`[EncryptByRule] Encryption key(${keyPath}) not found. Data at path: "${rule.path}" could not be encrypted`)
    else prepedData = await SEA.encrypt(data, key)
  }

  return prepedData;
}