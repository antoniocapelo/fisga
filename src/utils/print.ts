const DEBUG_ACTIVE = !!process.env.DEBUG_ACTIVE;

export const print = (message?: any, ...optionalParams: any[]):void => {
  if (!DEBUG_ACTIVE){
    return
  }
  console.log(message, ...optionalParams)
}