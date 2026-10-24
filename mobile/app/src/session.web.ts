const KEY = "circles.token";

export const getToken = async () => localStorage.getItem(KEY);
export const setToken = async (token: string) =>
  localStorage.setItem(KEY, token);
export const clearToken = async () => localStorage.removeItem(KEY);
