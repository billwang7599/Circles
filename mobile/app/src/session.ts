import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";

const KEY = "circles.token";

export const getToken = () => getItemAsync(KEY);
export const setToken = (token: string) => setItemAsync(KEY, token);
export const clearToken = () => deleteItemAsync(KEY);
