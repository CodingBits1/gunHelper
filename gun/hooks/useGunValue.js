import React, {useEffect, useCallback, useState, useRef} from "react";
import gunHelper from "../gunHelper";

export default function useGunValue(path, defaultValue){
  const [value, setValue] = useState(undefined);
  let loaded = useRef(false); 
  const setGunValue = useCallback((val) => {
    gunHelper.put(path, val)
  },[path])

  useEffect(() => {
    let listener = (val) => {
      loaded.current = true;
      setValue(val)
    }
    gunHelper.on(path, listener)
    return () => gunHelper.off(path, listener)
  },[path])

  if(loaded.current && value == undefined && defaultValue != undefined){
    setValue(defaultValue);
    setGunValue(defaultValue);
  }

  return [value, setGunValue ]
}