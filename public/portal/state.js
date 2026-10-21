// One live state binding shared by feature modules; no credentials in browser storage.
export let state = null;
export function setState(value) {
  state = value;
}
